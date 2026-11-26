/*
 * commands.ts
 *
 * commands for executing code in cells, both in the Source Editor and Visual Editor.
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { lines } from "core";
import { Range as LSRange } from 'vscode-languageserver-types';
import { CodeViewActiveBlockContext } from "editor-types";
import {
  Position,
  Range,
  Selection,
  TextEditor,
  TextDocument,
  TextEditorRevealType,
  window,
} from "vscode";
import {
  Token,
  TokenCodeBlock,
  TokenMath,
  isDisplayMath,
  isExecutableLanguageBlock,
  languageBlockAtPosition,
  languageNameFromBlock
} from "quarto-core";
import { Command } from "../../core/command";
import { isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { QuartoVisualEditor, VisualEditorProvider } from "../editor/editor";
import {
  blockHasExecutor,
  blockIsExecutable,
  cellMetadataForBlock,
  codeWithoutOptions,
  codeWithoutOptionsFromBlock,
  documentExecutableLanguages,
  executeInteractive,
  executeSelectionInteractive,
  executeAtPositionInteractive,
} from "./executors";
import { ExtensionHost } from "../../host";
import { tryAcquirePositronApi } from "@posit-dev/positron";
import { isKnitrDocument } from "../../host/executors";
import { commands } from "vscode";
import { virtualDocForCode, withVirtualDocUri } from "../../vdoc/vdoc";
import { embeddedLanguage } from "../../vdoc/languages";
import { Uri } from "vscode";

const isPositron = tryAcquirePositronApi();

export function cellCommands(host: ExtensionHost, engine: MarkdownEngine): Command[] {
  return [
    new RunCurrentCommand(host, engine),
    new RunSelectionCommand(host, engine),
    new RunCurrentAdvanceCommand(host, engine),
    new RunCurrentCellCommand(host, engine),
    new RunNextCellCommand(host, engine),
    new RunPreviousCellCommand(host, engine),
    new RunCellsAboveCommand(host, engine),
    new RunCellsBelowCommand(host, engine),
    new RunAllCellsCommand(host, engine),
    new GoToNextCellCommand(host, engine),
    new GoToPreviousCellCommand(host, engine),
  ];
}

abstract class RunCommand {
  constructor(
    protected readonly host_: ExtensionHost,
    protected readonly engine_: MarkdownEngine
  ) { }

  public async execute(line?: number): Promise<void> {
    // see if this is for the visual or the source editor
    const visualEditor = VisualEditorProvider.activeEditor();
    if (visualEditor) {
      const blockContext = await visualEditor.getActiveBlockContext();
      if (blockContext) {
        if (!this.requiresActiveExecutor() || await this.hasExecutorForLanguage(blockContext.activeLanguage, visualEditor.document, this.engine_)) {
          await this.doExecuteVisualMode(visualEditor, blockContext);
        } else if (!(await this.explainNoExecutor(blockContext.activeLanguage, visualEditor.document))) {
          window.showWarningMessage(`Execution of ${blockContext.activeLanguage} cells is not supported`);
        }
      } else {
        window.showWarningMessage("Editor selection is not within an executable cell");
      }
    } else {
      const editor = window.activeTextEditor;
      const doc = editor?.document;
      if (doc && isQuartoDoc(doc)) {
        const tokens = this.engine_.parse(doc);
        line = line || editor.selection.start.line;
        if (this.blockRequired()) {
          const block = languageBlockAtPosition(
            tokens,
            new Position(line, 0),
            this.includeFence()
          );
          if (block) {
            const language = languageNameFromBlock(block);
            if (!this.requiresActiveExecutor() || await this.hasExecutorForLanguage(language, doc, this.engine_)) {
              await this.doExecute(editor, tokens, line, block);
            } else if (isExecutableLanguageBlock(block)) {
              // a cell, not a display block: let the host say why it cannot
              // run, if it can (otherwise stay silent, as always)
              await this.explainNoExecutor(language, doc);
            }
          } else {
            window.showWarningMessage(
              "Editor selection is not within an executable cell"
            );
          }
        } else {
          await this.doExecute(editor, tokens, line);
        }
      } else {
        window.showWarningMessage("Active editor is not a Quarto document");
      }
    }


  }

  protected includeFence() {
    return true;
  }

  protected blockRequired() {
    return true;
  }

  // whether the cell at the cursor must be one that can run: true for the
  // commands that run it, false for the ones that run a cell next to it
  protected requiresActiveExecutor() {
    return true;
  }

  protected abstract doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void>;

  protected abstract doExecute(
    editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ): Promise<void>;

  protected async cellExecutorForLanguage(language: string, document: TextDocument, engine: MarkdownEngine) {
    return await this.host_.cellExecutorForLanguage(language, document, engine);
  }

  protected executableLanguages(document: TextDocument) {
    return documentExecutableLanguages(this.host_, document, this.engine_);
  }

  // the runtime that runs a cell language in `document`: a run of several
  // cells runs the cells that share one
  protected runtimeOf(document: TextDocument): (language: string) => string {
    return (language) => this.host_.cellRuntimeLanguage?.(language, document, this.engine_) ?? language;
  }

  // run the whole of a visual editor block, without its cell options
  protected async runVisualBlock(editor: QuartoVisualEditor, block: { language: string; code: string; }) {
    const executor = await this.cellExecutorForLanguage(block.language, editor.document, this.engine_);
    if (executor) {
      await executeInteractive(executor, [codeWithoutOptions(block.language, block.code)], editor.document);
      await activateIfRequired(editor);
    }
  }

  private async explainNoExecutor(language: string, document: TextDocument): Promise<boolean> {
    return (await this.host_.explainNoExecutor?.(language, document)) ?? false;
  }

  private async hasExecutorForLanguage(language: string, document: TextDocument, engine: MarkdownEngine) {
    return undefined !== (await this.cellExecutorForLanguage(language, document, engine));
  }

}

class RunCurrentCellCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runCurrentCell";
  public readonly id = RunCurrentCellCommand.id;

  override async doExecute(
    editor: TextEditor,
    _tokens: Token[],
    _line: number,
    block?: Token
  ) {
    if (block && isExecutableLanguageBlock(block)) {
      const language = languageNameFromBlock(block);
      const executor = await this.cellExecutorForLanguage(language, editor.document, this.engine_);
      if (executor) {
        const code = codeWithoutOptionsFromBlock(block);
        const ranges = [toVscodeRange(block.range)];
        const metadata = cellMetadataForBlock(block);
        await executeInteractive(executor, [code], editor.document, ranges, metadata ? [metadata] : undefined);
      }
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const activeBlock = context.blocks.find(block => block.active);
    if (activeBlock) {
      await this.runVisualBlock(editor, activeBlock);
    }
  }
}

class RunNextCellCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runNextCell";
  public readonly id = RunNextCellCommand.id;

  override requiresActiveExecutor() {
    return false;
  }

  override async doExecute(editor: TextEditor, tokens: Token[], line: number) {
    const languages = this.executableLanguages(editor.document);
    const block = nextBlock(languages, line, tokens, true);
    if (block) {
      await runAdjacentBlock(this.host_, editor, this.engine_, block);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const activeBlockIndex = context.blocks.findIndex(block => block.active);
    const nextBlock = context.blocks[activeBlockIndex + 1];
    if (nextBlock) {
      await editor.setBlockSelection(context, "nextblock");
      await this.runVisualBlock(editor, nextBlock);
    } else {
      window.showInformationMessage("No more cells available to execute");
    }
  }
}

class RunPreviousCellCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runPreviousCell";
  public readonly id = RunPreviousCellCommand.id;

  override requiresActiveExecutor() {
    return false;
  }

  override async doExecute(editor: TextEditor, tokens: Token[], line: number) {
    const languages = this.executableLanguages(editor.document);
    const block = previousBlock(languages, line, tokens, true);
    if (block) {
      await runAdjacentBlock(this.host_, editor, this.engine_, block);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const activeBlockIndex = context.blocks.findIndex(block => block.active);
    const prevBlock = context.blocks[activeBlockIndex - 1];
    if (prevBlock) {
      await editor.setBlockSelection(context, "prevblock");
      await this.runVisualBlock(editor, prevBlock);
    } else {
      window.showInformationMessage("No more cells available to execute");
    }
  }
}

// More permissive type than `Position` so its easier to construct via a literal
type LineAndCharPos = { line: number, character: number; };


// Run the code at the cursor
class RunCurrentCommand extends RunCommand implements Command {
  constructor(
    host: ExtensionHost,
    engine: MarkdownEngine,
    private readonly runSelection_ = false
  ) {
    super(host, engine);
  }

  public readonly id: string = "quarto.runCurrent";

  override includeFence() {
    return false;
  }

  override async doExecute(
    editor: TextEditor,
    _tokens: Token[],
    _line: number,
    block: Token
  ) {
    // get language and attempt language aware runSelection
    const language = languageNameFromBlock(block);
    const executor = await this.cellExecutorForLanguage(language, editor.document, this.engine_);
    if (executor && isExecutableLanguageBlock(block)) {
      // Resolve this command to "run cell" when we can't find a selection:
      // - the selection is empty
      // - this is not a knitr document
      // - this is not a Python or R document being used in Positron
      // or when the selection is empty and the cell can only run as a whole
      const resolveToRunCell = editor.selection.isEmpty && (
        executor.runsWholeCell || (
          !this.runSelection_ &&
          !isKnitrDocument(editor.document, this.engine_) &&
          (!isPositron && (language === "python" || language === "r"))
        ));

      if (resolveToRunCell) {
        const code = codeWithoutOptionsFromBlock(block);
        const metadata = cellMetadataForBlock(block);
        await executeInteractive(executor, [code], editor.document, undefined, metadata ? [metadata] : undefined);
      } else {
        // submit
        const executed = await executeSelectionInteractive(executor);

        // if the executor isn't capable of language aware runSelection
        // then determine the selection manually
        if (!executed) {
          // if the selection is empty take the whole line, otherwise
          // take the selected text exactly
          const selection = editor.selection.isEmpty
            ? editor.document.getText(
              new Range(
                new Position(editor.selection.start.line, 0),
                new Position(
                  editor.selection.end.line,
                  editor.document.lineAt(editor.selection.end).text.length
                )
              )
            )
            : editor.document.getText(editor.selection);

          // for empty selections we advance to the next line
          if (editor.selection.isEmpty) {
            const selPos = new Position(editor.selection.start.line + 1, 0);
            editor.selection = new Selection(selPos, selPos);
          }

          // run code
          await executeInteractive(executor, [selection], editor.document);
        }
      }
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    // get selection and active block
    const selection = context.selectedText;
    const activeBlock = context.blocks.find(block => block.active);

    // without a selection, a cell that can only run as a whole runs as a whole
    if (activeBlock && selection.length <= 0) {
      const executor = await this.cellExecutorForLanguage(activeBlock.language, editor.document, this.engine_);
      if (executor?.runsWholeCell) {
        await executeInteractive(executor, [activeBlock.code], editor.document);
        await activateIfRequired(editor);
        return;
      }
    }

    // if in Positron
    if (isPositron) {
      const activeEmbeddedLanguage = activeBlock && embeddedLanguage(activeBlock.language);
      if (activeBlock && selection.length <= 0 && !activeEmbeddedLanguage) {
        // A language Positron runs but this extension has no virtual document
        // for (e.g. `ggsql`) has no statement ranges here to step through, so
        // run the whole cell.
        await this.runVisualBlock(editor, activeBlock);
      } else if (activeBlock && selection.length <= 0 && activeEmbeddedLanguage) {
        const codeLines = lines(activeBlock.code);
        const vdoc = virtualDocForCode(codeLines, activeEmbeddedLanguage);
        const parentUri = Uri.file(editor.document.fileName);
        const injectedLines = (vdoc.language?.inject?.length ?? 0);

        const positionIntoVdoc = (p: LineAndCharPos) =>
          new Position(p.line + injectedLines, p.character);
        const positionOutOfVdoc = (p: LineAndCharPos) =>
          new Position(p.line - injectedLines, p.character);

        const executor = await this.cellExecutorForLanguage(context.activeLanguage, editor.document, this.engine_);
        if (executor) {
          const nextStatementPos = await withVirtualDocUri(
            vdoc,
            parentUri,
            "executeSelectionAtPositionInteractive",
            (uri) => executeAtPositionInteractive(
              executor,
              uri,
              positionIntoVdoc(context.selection.start)
            )
          );

          if (nextStatementPos !== undefined) {
            await editor.setBlockSelection(context, positionOutOfVdoc(nextStatementPos));
          }
        }
      }
      // if not in Positron
    } else {
      // if the selection is empty and this isn't a knitr document then it resolves to run cell
      if (selection.length <= 0 && !isKnitrDocument(editor.document, this.engine_)) {
        if (activeBlock) {
          await this.runVisualBlock(editor, activeBlock);
        }
      } else {
        const executor = await this.cellExecutorForLanguage(context.activeLanguage, editor.document, this.engine_);
        if (executor) {
          if (selection.length > 0) {
            await executeInteractive(executor, [selection], editor.document);
            await editor.setBlockSelection(context, "nextline");
          } else if (activeBlock) { // if the selection is empty take the whole line as the selection
            await executeInteractive(executor, [lines(activeBlock.code)[context.selection.start.line]], editor.document);
            await editor.setBlockSelection(context, "nextline");
          }

        }

      }
    }
  }
}


class RunSelectionCommand extends RunCurrentCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine, true);
  }
  public readonly id = "quarto.runSelection";

}

// Run Cell and Advance
class RunCurrentAdvanceCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runCurrentAdvance";
  public readonly id = RunCurrentAdvanceCommand.id;

  override includeFence() {
    return false;
  }

  override async doExecute(
    _editor: TextEditor,
    _tokens: Token[],
    _line: number,
    block: Token
  ) {
    if (block && isExecutableLanguageBlock(block)) {
      await commands.executeCommand("quarto.runCurrentCell");
      await commands.executeCommand("quarto.goToNextCell");
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const activeBlock = context.blocks.find(block => block.active);
    if (activeBlock) {
      const executor = await this.cellExecutorForLanguage(activeBlock.language, editor.document, this.engine_);
      if (executor) {
        await executeInteractive(executor, [codeWithoutOptions(activeBlock.language, activeBlock.code)], editor.document);
        const blockContext = await editor.getActiveBlockContext();
        if (blockContext) {
          await editor.setBlockSelection(blockContext, "nextblock");
        }
      }
    }
  }
}


class RunCellsAboveCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runCellsAbove";
  public readonly id = RunCellsAboveCommand.id;

  override blockRequired(): boolean {
    return false;
  }

  override async doExecute(
    editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ) {
    // collect up blocks prior to the active one
    const blocks: Array<TokenMath | TokenCodeBlock> = [];
    const languages = this.executableLanguages(editor.document);
    for (const blk of tokens.filter((token?: Token) => blockIsExecutable(languages, token)) as Array<TokenMath | TokenCodeBlock>) {
      // if the end of this block is past the line then bail
      if (blk.range.end.line > line) {
        break;
      }
      blocks.push(blk);
    }

    if (blocks.length > 0) {
      // we need to figure out which language to execute. this is either the language
      // of the passed block (if any) or the language of the block immediately preceding
      // the line this is executed from
      const language = languageNameFromBlock(
        block || blocks[blocks.length - 1]
      );

      const executor = await this.cellExecutorForLanguage(language, editor.document, this.engine_);
      if (executor) {
        // accumulate code, ranges, and metadata of the cells that share its runtime
        const runtimeOf = this.runtimeOf(editor.document);
        const runtime = runtimeOf(language);
        const code: string[] = [];
        const ranges: Range[] = [];
        const metadata: (Record<string, unknown> | undefined)[] = [];
        for (const blk of blocks.filter((blk) => runtimeOf(languageNameFromBlock(blk)) === runtime)) {
          code.push(codeWithoutOptionsFromBlock(blk));
          metadata.push(cellMetadataForBlock(blk));
          ranges.push(toVscodeRange(blk.range));
        }

        // execute (only pass ranges if we collected the same number as code blocks)
        const validRanges = ranges.length === code.length ? ranges : undefined;
        const validMetadata = metadata.some(m => m !== undefined) ? metadata.map(m => m ?? {}) : undefined;
        await executeInteractive(executor, code, editor.document, validRanges, validMetadata);
      }
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const executor = await this.cellExecutorForLanguage(context.activeLanguage, editor.document, this.engine_);
    if (executor) {
      const runtimeOf = this.runtimeOf(editor.document);
      const runtime = runtimeOf(context.activeLanguage);
      const code: string[] = [];
      for (const block of context.blocks) {
        if (block.active) {
          break;
        } else if (runtimeOf(block.language) === runtime) {
          code.push(codeWithoutOptions(block.language, block.code));
        }
      }
      if (code.length > 0) {
        await executeInteractive(executor, code, editor.document);
        await activateIfRequired(editor);
      }
    }
  }
}

class RunCellsBelowCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runCellsBelow";
  public readonly id = RunCellsBelowCommand.id;

  override blockRequired(): boolean {
    return false;
  }

  override async doExecute(
    editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ) {
    // see if we can get the language from the current block
    const languages = this.executableLanguages(editor.document);
    // skip the cells above or at the cursor
    const below = tokens.filter((token?: Token) =>
      blockIsExecutable(languages, token) && line < token.range.start.line
    ) as Array<TokenMath | TokenCodeBlock>;
    const language = blockHasExecutor(languages, block)
      ? languageNameFromBlock(block!)
      : below[0] && languageNameFromBlock(below[0]);

    const blocks: string[] = [];
    const ranges: Range[] = [];
    const metadata: (Record<string, unknown> | undefined)[] = [];
    // include blocks that share this language's runtime
    const runtimeOf = this.runtimeOf(editor.document);
    const runtime = language && runtimeOf(language);
    for (const blk of below.filter((blk) => runtimeOf(languageNameFromBlock(blk)) === runtime)) {
      blocks.push(codeWithoutOptionsFromBlock(blk));
      ranges.push(toVscodeRange(blk.range));
      metadata.push(cellMetadataForBlock(blk));
    }
    // execute (only pass ranges if we collected the same number as code blocks)
    if (language && blocks.length > 0) {
      const executor = await this.cellExecutorForLanguage(language, editor.document, this.engine_);
      if (executor) {
        const validRanges = ranges.length === blocks.length ? ranges : undefined;
        const validMetadata = metadata.some(m => m !== undefined) ? metadata.map(m => m ?? {}) : undefined;
        await executeInteractive(executor, blocks, editor.document, validRanges, validMetadata);
      }
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const executor = await this.cellExecutorForLanguage(context.activeLanguage, editor.document, this.engine_);
    if (executor) {
      const runtimeOf = this.runtimeOf(editor.document);
      const runtime = runtimeOf(context.activeLanguage);
      let code: string[] | undefined;
      for (const block of context.blocks) {
        if (block.active) {
          code = [];
        } else if (code && runtimeOf(block.language) === runtime) {
          code.push(codeWithoutOptions(block.language, block.code));
        }
      }
      if (code && code.length > 0) {
        await executeInteractive(executor, code, editor.document);
        await activateIfRequired(editor);
      }
    }
  }
}

class RunAllCellsCommand extends RunCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine);
  }
  private static readonly id = "quarto.runAllCells";
  public readonly id = RunAllCellsCommand.id;

  override blockRequired(): boolean {
    return false;
  }

  override async doExecute(
    editor: TextEditor,
    tokens: Token[],
    _line: number,
    _block?: Token
  ) {
    const blocks: string[] = [];
    const ranges: Range[] = [];
    const metadata: (Record<string, unknown> | undefined)[] = [];
    const languages = this.executableLanguages(editor.document);
    const executable = tokens.filter((token?: Token) => blockIsExecutable(languages, token)) as Array<TokenMath | TokenCodeBlock>;
    // the first cell's language, and the cells that share its runtime
    const language = executable[0] && languageNameFromBlock(executable[0]);
    const runtimeOf = this.runtimeOf(editor.document);
    const runtime = language && runtimeOf(language);
    for (const blk of executable.filter((blk) => runtimeOf(languageNameFromBlock(blk)) === runtime)) {
      blocks.push(codeWithoutOptionsFromBlock(blk));
      metadata.push(cellMetadataForBlock(blk));
      ranges.push(toVscodeRange(blk.range));
    }
    if (language && blocks.length > 0) {
      const executor = await this.cellExecutorForLanguage(language, editor.document, this.engine_);
      if (executor) {
        // only pass ranges if we collected the same number as code blocks
        const validRanges = ranges.length === blocks.length ? ranges : undefined;
        const validMetadata = metadata.some(m => m !== undefined) ? metadata.map(m => m ?? {}) : undefined;
        await executeInteractive(executor, blocks, editor.document, validRanges, validMetadata);
      }
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ): Promise<void> {
    const runtimeOf = this.runtimeOf(editor.document);
    const runtime = runtimeOf(context.activeLanguage);
    const code: string[] = [];
    for (const block of context.blocks) {
      if (runtimeOf(block.language) === runtime) {
        code.push(codeWithoutOptions(block.language, block.code));
      }
    }
    if (code.length > 0) {
      const executor = await this.cellExecutorForLanguage(context.activeLanguage, editor.document, this.engine_);
      if (executor) {
        await executeInteractive(executor, code, editor.document);
        await activateIfRequired(editor);
      }
    }
  }
}

class GoToCellCommand {
  constructor(
    host: ExtensionHost,
    engine: MarkdownEngine,
    dir: "next" | "previous"
  ) {
    this.host_ = host;
    this.engine_ = engine;
    this.dir_ = dir;
  }

  async execute(): Promise<void> {
    const visualEditor = VisualEditorProvider.activeEditor();
    if (visualEditor) {
      const blockContext = await visualEditor.getActiveBlockContext();
      if (blockContext) {
        if (this.dir_ === "next") {
          await visualEditor.setBlockSelection(blockContext, "nextblock");
        } else {
          await visualEditor.setBlockSelection(blockContext, "prevblock");
        }
        await activateIfRequired(visualEditor);
      } else {
        window.showWarningMessage("Editor selection is not within an executable cell");
      }
    } else {
      const editor = window.activeTextEditor;
      const doc = editor?.document;
      if (doc && isQuartoDoc(doc)) {
        const tokens = this.engine_.parse(doc);
        const line = editor.selection.start.line;
        const selector = this.dir_ === "next" ? nextBlock : previousBlock;
        // no executor required, so no executable languages to look up
        const cell = selector(new Set(), line, tokens, false, false);
        if (cell) {
          navigateToBlock(editor, cell);
        }
      }
    }

  }


  private host_: ExtensionHost;
  private engine_: MarkdownEngine;
  private dir_: "next" | "previous";
}

class GoToNextCellCommand extends GoToCellCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine, "next");
  }
  private static readonly id = "quarto.goToNextCell";
  public readonly id = GoToNextCellCommand.id;
}

class GoToPreviousCellCommand extends GoToCellCommand implements Command {
  constructor(host: ExtensionHost, engine: MarkdownEngine) {
    super(host, engine, "previous");
  }
  private static readonly id = "quarto.goToPreviousCell";
  public readonly id = GoToPreviousCellCommand.id;
}

async function runAdjacentBlock(host: ExtensionHost, editor: TextEditor, engine: MarkdownEngine, block: TokenMath | TokenCodeBlock) {
  navigateToBlock(editor, block);
  const language = languageNameFromBlock(block);
  const executor = await host.cellExecutorForLanguage(language, editor.document, engine);
  if (executor) {
    const ranges = [toVscodeRange(block.range)];
    const metadata = cellMetadataForBlock(block);
    await executeInteractive(executor, [codeWithoutOptionsFromBlock(block)], editor.document, ranges, metadata ? [metadata] : undefined);
  }
}

function navigateToBlock(editor: TextEditor, block: Token) {
  const blockPos = new Position(block.range.start.line + 1, 0);
  editor.selection = new Selection(blockPos, blockPos);
  editor.revealRange(
    new Range(new Position(block.range.start.line, 0), new Position(block.range.start.line, 0)),
    TextEditorRevealType.InCenterIfOutsideViewport
  );
}

function nextBlock(
  languages: ReadonlySet<string>,
  line: number,
  tokens: Token[],
  requireEvaluated = false,
  requireExecutor = true
): TokenMath | TokenCodeBlock | undefined {
  for (const block of tokens.filter(
    requireExecutor
      ? requireEvaluated
        ? (token?: Token) => blockIsExecutable(languages, token)
        : (token?: Token) => blockHasExecutor(languages, token)
      : (token?: Token) => token && isExecutableLanguageBlock(token) && !isDisplayMath(token)
  )) {
    if (block.range.start.line > line) {
      return block as TokenMath | TokenCodeBlock;
    }
  }
  return undefined;
}

function previousBlock(
  languages: ReadonlySet<string>,
  line: number,
  tokens: Token[],
  requireEvaluated = false,
  requireExecutor = true
): TokenMath | TokenCodeBlock | undefined {
  for (const block of tokens
    .filter(
      requireExecutor
        ? requireEvaluated
          ? (token?: Token) => blockIsExecutable(languages, token)
          : (token?: Token) => blockHasExecutor(languages, token)
        : (token?: Token) => token && isExecutableLanguageBlock(token) && !isDisplayMath(token))
    .reverse()) {
    if (block.range.end.line < line) {
      return block as TokenMath | TokenCodeBlock;
    }
  }
  return undefined;
}

async function activateIfRequired(editor: QuartoVisualEditor) {
  if (!(await editor.hasFocus())) {
    await editor.activate();
  }
}

/** Convert a plain LSP-style range to a VS Code Range instance. */
function toVscodeRange(range: LSRange): Range {
  return new Range(
    new Position(range.start.line, range.start.character),
    new Position(range.end.line, range.end.character)
  );
}
