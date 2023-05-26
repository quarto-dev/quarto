/*
 * commands.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { lines } from "core";
import { CodeViewActiveBlockContext, CodeViewSelectionAction } from "editor-types";
import {
  Position,
  Range,
  Selection,
  TextEditor,
  TextEditorRevealType,
  window,
} from "vscode";
import { Token, TokenCodeBlock, TokenMath, isExecutableLanguageBlock, isExecutableLanguageBlockOf, languageBlockAtPosition, languageNameFromBlock } from "quarto-core";
import { Command } from "../../core/command";
import { isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { QuartoVisualEditor, VisualEditorProvider } from "../editor/editor";
import {
  blockHasExecutor,
  blockIsExecutable,
  codeFromBlock,
  ensureRequiredExtension,
  executeInteractive,
  executeSelectionInteractive,
  hasExecutor,
} from "./executors";

export function cellCommands(engine: MarkdownEngine): Command[] {
  return [
    new RunSelectionCommand(engine),
    new RunCurrentCellCommand(engine),
    new RunNextCellCommand(engine),
    new RunPreviousCellCommand(engine),
    new RunCellsAboveCommand(engine),
    new RunCellsBelowCommand(engine),
    new RunAllCellsCommand(engine),
    new GoToNextCellCommand(engine),
    new GoToPreviousCellCommand(engine),
  ];
}

abstract class RunCommand {
  constructor(engine: MarkdownEngine) {
    this.engine_ = engine;
  }

  public async execute(line?: number): Promise<void> {

    // see if this is for the visual or the source editor
    const visualEditor = VisualEditorProvider.activeEditor();
    if (visualEditor) {
      const blockContext = await visualEditor.getActiveBlockContext();
      if (blockContext) {
        if (hasExecutor(blockContext.activeLanguage)) {
          await this.doExecuteVisualMode(visualEditor, blockContext);
        } else {
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
            if (await ensureRequiredExtension(language, doc, this.engine_)) {
              await this.doExecute(editor, tokens, line, block);
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

  protected abstract doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void>;

  protected abstract doExecute(
    editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ): Promise<void>;

  private engine_: MarkdownEngine;
}

class RunCurrentCellCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
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
      const code = codeFromBlock(block);
      await executeInteractive(language, [code], editor.document);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {
    const activeBlock = context.blocks.find(block => block.active);
    if (activeBlock) {
      await executeInteractive(context.activeLanguage, [activeBlock.code], editor.document);
      await activateIfRequired(editor);
    }
  }

}

class RunNextCellCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runNextCell";
  public readonly id = RunNextCellCommand.id;

  override async doExecute(editor: TextEditor, tokens: Token[], line: number) {
    const block = nextBlock(line, tokens, true);
    if (block) {
      await runAdjacentBlock(editor, block);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {
    const activeBlockIndex = context.blocks.findIndex(block => block.active);
    const nextBlock = context.blocks[activeBlockIndex + 1];
    if (nextBlock) {
      await editor.setBlockSelection(context, "nextblock");
      if (hasExecutor(nextBlock.language)) {
        await executeInteractive(nextBlock.language, [nextBlock.code], editor.document);
        await activateIfRequired(editor);
      }
    } else {
      window.showInformationMessage("No more cells available to execute");
    }
  }
}

class RunPreviousCellCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runPreviousCell";
  public readonly id = RunPreviousCellCommand.id;

  override async doExecute(editor: TextEditor, tokens: Token[], line: number) {
    const block = previousBlock(line, tokens, true);
    if (block) {
      if (block) {
        await runAdjacentBlock(editor, block);
      }
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {
    const activeBlockIndex = context.blocks.findIndex(block => block.active);
    const prevBlock = context.blocks[activeBlockIndex - 1];
    if (prevBlock) {
      await editor.setBlockSelection(context, "prevblock");
      if (hasExecutor(prevBlock.language)) {
        await executeInteractive(prevBlock.language, [prevBlock.code], editor.document);
        await activateIfRequired(editor);
      }
    } else {
      window.showInformationMessage("No more cells available to execute");
    }
  }
}

class RunSelectionCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runSelection";
  public readonly id = RunSelectionCommand.id;

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
    const executed = await executeSelectionInteractive(language);

    // if the executor isn't capable of lenguage aware runSelection
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
      await executeInteractive(language, [selection], editor.document);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {
    // if the selection is empty take the whole line, otherwise take the selected text exactly
    let selection = context.selectedText;
    let action: CodeViewSelectionAction | undefined;
    if (selection.length <= 0) {
      const activeBlock = context.blocks.find(block => block.active);
      if (activeBlock) {
        selection = lines(activeBlock.code)[context.selection.start.line];
        action = "nextline";
      }
    }

    // run code
    await executeInteractive(context.activeLanguage, [selection], editor.document);
    
    // advance cursor if necessary
    if (action) {
      editor.setBlockSelection(context, "nextline");
    }
  }
}

class RunCellsAboveCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
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
    const blocks: Token[] = [];
    for (const blk of tokens.filter(blockIsExecutable)) {
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

      // accumulate code
      const code: string[] = [];
      for (const block of blocks.filter(
        isExecutableLanguageBlockOf(language)
      )) {
        code.push(codeFromBlock(block));
      }

      // execute
      await executeInteractive(language, code, editor.document);
    }
  }
  
  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {
    const code: string[] = [];
    for (const block of context.blocks) {
      if (block.active) {
        break;
      } else if (block.language === context.activeLanguage) {
        code.push(block.code);
      }
    }
    if (code.length > 0) {
      await executeInteractive(context.activeLanguage, code, editor.document);
      await activateIfRequired(editor);
    }
  }
}

class RunCellsBelowCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
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
    let language = blockHasExecutor(block)
      ? languageNameFromBlock(block!)
      : undefined;

    const blocks: string[] = [];
    for (const blk of tokens.filter(blockIsExecutable)) {
      // skip if the cell is above or at the cursor
      if (line < blk.range.start.line) {
        // set langauge if needed
        const blockLanguage = languageNameFromBlock(blk);
        if (!language) {
          language = blockLanguage;
        }
        // include blocks of this language
        if (blockLanguage === language) {
          blocks.push(codeFromBlock(blk));
        }
      }
    }
    // execute
    if (language && blocks.length > 0) {
      await executeInteractive(language, blocks, editor.document);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {

    let code: string[] | undefined;
    for (const block of context.blocks) {
      if (block.active) {
        code = [];
      } else if (code && (block.language === context.activeLanguage)) {
        code.push(block.code);
      }
    }
    if (code && code.length > 0) {
      await executeInteractive(context.activeLanguage, code, editor.document);
      await activateIfRequired(editor);
    }
  }
}

class RunAllCellsCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
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
    let language: string | undefined;
    const blocks: string[] = [];
    for (const block of tokens.filter(blockIsExecutable)) {
      const blockLanguage = languageNameFromBlock(block);
      if (!language) {
        language = blockLanguage;
      }
      if (blockLanguage === language) {
        blocks.push(codeFromBlock(block));
      }
    }
    if (language && blocks.length > 0) {
      await executeInteractive(language, blocks, editor.document);
    }
  }

  override async doExecuteVisualMode(
    editor: QuartoVisualEditor,
    context: CodeViewActiveBlockContext
  ) : Promise<void> {
    const code : string[] = [];
    for (const block of context.blocks) {
      if (block.language === context.activeLanguage) {
        code.push(block.code);
      }
    }
    if (code.length > 0) {
      await executeInteractive(context.activeLanguage, code, editor.document);
      await activateIfRequired(editor);
    }
  }
}

class GoToCellCommand {
  constructor(
    engine: MarkdownEngine,
    dir: "next" | "previous"
  ) {
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
        const cell = selector(line, tokens);
        if (cell) {
          navigateToBlock(editor, cell);
        }
      }
    }
    
  }

  private engine_: MarkdownEngine;
  private dir_: "next" | "previous";
}

class GoToNextCellCommand extends GoToCellCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine, "next");
  }
  private static readonly id = "quarto.goToNextCell";
  public readonly id = GoToNextCellCommand.id;
}

class GoToPreviousCellCommand extends GoToCellCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine, "previous");
  }
  private static readonly id = "quarto.goToPreviousCell";
  public readonly id = GoToPreviousCellCommand.id;
}

async function runAdjacentBlock(editor: TextEditor, block: TokenMath | TokenCodeBlock) {
  navigateToBlock(editor, block);
  const language = languageNameFromBlock(block);
  await executeInteractive(language, [codeFromBlock(block)], editor.document);
}

function navigateToBlock(editor: TextEditor, block: Token) {
  const blockPos = new Position(block.range.start.line + 1, 0);
  editor.selection = new Selection(blockPos, blockPos);
  editor.revealRange(
    new Range(new Position(block.range.start.line, 0), new Position(block.range.start.line, 0)),
    TextEditorRevealType.InCenterIfOutsideViewport
  );
}

function nextBlock(line: number, tokens: Token[], requireExecutable = false) {
  for (const block of tokens.filter(
    requireExecutable ? blockIsExecutable : blockHasExecutor
  )) {
    if (block.range.start.line > line) {
      return block;
    }
  }
  return undefined;
}

function previousBlock(
  line: number,
  tokens: Token[],
  requireExecutable = false
) {
  for (const block of tokens
    .filter(requireExecutable ? blockIsExecutable : blockHasExecutor)
    .reverse()) {
    if (block.range.end.line < line) {
      return block;
    }
  }
  return undefined;
}

async function activateIfRequired(editor: QuartoVisualEditor) {
  if (!(await editor.hasFocus())) {
    await editor.activate();
  }
}
