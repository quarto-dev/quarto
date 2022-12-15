/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Token from "markdown-it/lib/token";
import {
  Position,
  Range,
  Selection,
  TextEditor,
  TextEditorRevealType,
  window,
} from "vscode";
import { Command } from "../../core/command";
import { isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isExecutableLanguageBlockOf,
  languageNameFromBlock,
  languageBlockAtPosition,
} from "../../markdown/language";
import {
  blockHasExecutor,
  blockIsExecutable,
  codeFromBlock,
  ensureRequiredExtension,
  executeInteractive,
  executeSelectionInteractive,
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
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const tokens = await this.engine_.parse(doc);
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
          window.showInformationMessage(
            "Editor selection is not within an executable cell"
          );
        }
      } else {
        await this.doExecute(editor, tokens, line);
      }
    } else {
      window.showInformationMessage("Active editor is not a Quarto document");
    }
  }

  protected includeFence() {
    return true;
  }

  protected blockRequired() {
    return true;
  }

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
    _editor: TextEditor,
    _tokens: Token[],
    _line: number,
    block?: Token
  ) {
    if (block) {
      const language = languageNameFromBlock(block);
      const code = codeFromBlock(block);
      await executeInteractive(language, [code]);
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
      await executeInteractive(language, [selection]);
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
    _editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ) {
    // collect up blocks prior to the active one
    const blocks: Token[] = [];
    for (const blk of tokens.filter(blockIsExecutable)) {
      // if the end of this block is past the line then bail
      if (!blk.map || blk.map[1] > line) {
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
      await executeInteractive(language, code);
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
    _editor: TextEditor,
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
      if (blk.map && line < blk.map[0]) {
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
      await executeInteractive(language, blocks);
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
    _editor: TextEditor,
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
      await executeInteractive(language, blocks);
    }
  }
}

class GoToCellCommand {
  constructor(
    engine: MarkdownEngine,
    selector: (line: number, tokens: Token[]) => Token | undefined
  ) {
    this.engine_ = engine;
    this.selector_ = selector;
  }

  async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const tokens = await this.engine_.parse(doc);
      const line = editor.selection.start.line;
      const cell = this.selector_(line, tokens);
      if (cell) {
        navigateToBlock(editor, cell);
      }
    }
  }

  private engine_: MarkdownEngine;
  private selector_: (line: number, tokens: Token[]) => Token | undefined;
}

class GoToNextCellCommand extends GoToCellCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine, nextBlock);
  }
  private static readonly id = "quarto.goToNextCell";
  public readonly id = GoToNextCellCommand.id;
}

class GoToPreviousCellCommand extends GoToCellCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine, previousBlock);
  }
  private static readonly id = "quarto.goToPreviousCell";
  public readonly id = GoToPreviousCellCommand.id;
}

async function runAdjacentBlock(editor: TextEditor, block: Token) {
  if (block.map) {
    navigateToBlock(editor, block);
    const language = languageNameFromBlock(block);
    await executeInteractive(language, [codeFromBlock(block)]);
  }
}

function navigateToBlock(editor: TextEditor, block: Token) {
  if (block.map) {
    const blockPos = new Position(block.map[0] + 1, 0);
    editor.selection = new Selection(blockPos, blockPos);
    editor.revealRange(
      new Range(new Position(block.map[0], 0), new Position(block.map[0], 0)),
      TextEditorRevealType.InCenterIfOutsideViewport
    );
  }
}

function nextBlock(line: number, tokens: Token[], requireExecutable = false) {
  for (const block of tokens.filter(
    requireExecutable ? blockIsExecutable : blockHasExecutor
  )) {
    if (block.map && block.map[0] > line) {
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
    if (block.map && block.map[1] < line) {
      return block;
    }
  }
  return undefined;
}
