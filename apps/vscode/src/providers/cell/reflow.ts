/*
 * reflow.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { EndOfLine, Position, Range, window, workspace } from "vscode";

import { lines } from "core";
import {
  TokenCodeBlock,
  TokenMath,
  codeForExecutableLanguageBlock,
  languageBlockAtLine,
  languageNameFromBlock,
} from "quarto-core";

import { Command } from "../../core/command";
import { isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { languageFromBlock } from "../../vdoc/vdoc";
import { escapeRegExp, langCommentChars, optionCommentPattern } from "./comment-chars";

export function reflowCommands(engine: MarkdownEngine): Command[] {
  return [new ReflowCommentInCellCommand(engine)];
}

const kDefaultReflowColumn = 80;

class ReflowCommentInCellCommand implements Command {
  public readonly id = "quarto.reflowCommentInCell";
  constructor(private readonly engine_: MarkdownEngine) { }

  public async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      // No active text editor
      return;
    }

    const document = editor.document;
    if (!isQuartoDoc(document)) {
      window.showInformationMessage("Active editor is not a Quarto document");
      return;
    }

    const includeFence = false;

    const tokens = this.engine_.parse(document);
    const block = languageBlockAtLine(tokens, editor.selection.start.line, includeFence);
    if (!block) {
      window.showInformationMessage("Editor selection is not within a code cell.");
      return;
    }

    const comment = lineCommentForBlock(block);
    if (!comment) {
      window.showInformationMessage(
        `Comment reflow is not supported for ${languageNameFromBlock(block)} cells.`
      );
      return;
    }

    const column = workspace
      .getConfiguration("quarto")
      .get<number>("cells.reflowColumn", kDefaultReflowColumn);

    // The `+ 1` skips the opening fence line.
    const lineOffset = block.range.start.line + 1;

    const cellLines = lines(codeForExecutableLanguageBlock(block, false));
    let reflows = reflowComments(cellLines, comment, column);

    // With a selection, only reflow the lines that overlap it; with just a
    // cursor, reflow the whole cell.
    const selections = editor.selections.filter((selection) => !selection.isEmpty);
    if (selections.length > 0) {
      reflows = reflows.filter((reflow) =>
        selections.some((selection) => {
          const line = lineOffset + reflow.line;
          // A selection ending at the start of a line doesn't include that line
          const endLine =
            selection.end.character === 0 && selection.end.line > selection.start.line
              ? selection.end.line - 1
              : selection.end.line;
          return line >= selection.start.line && line <= endLine;
        })
      );
    }
    if (reflows.length === 0) {
      return;
    }

    // Use the document's line ending to avoid introducing mixed EOL in CRLF files.
    const eol = document.eol === EndOfLine.CRLF ? "\r\n" : "\n";

    await editor.edit((editBuilder) => {
      // Sort by descending position to avoid range shifting issues
      [...reflows]
        .sort((a, b) => b.line - a.line)
        .forEach((reflow) => {
          const range = new Range(
            new Position(lineOffset + reflow.line, 0),
            document.lineAt(lineOffset + reflow.line).range.end
          );
          editBuilder.replace(range, reflow.newLines.join(eol));
        });
    });
  }
}

// Resolve the line comment string for a block. Prefer the canonical comment
// from `editor-core` (via the embedded language) and fall back to the
// executor-oriented map in `cell/options.ts` for languages that aren't
// embedded (lua, haskell, fortran, ...). Languages that only have block
// comments (a [open, close] tuple in the map) return undefined.
function lineCommentForBlock(block: TokenMath | TokenCodeBlock): string | undefined {
  const language = languageFromBlock(block);
  if (language?.comment) {
    return language.comment;
  }
  const commentChars = langCommentChars(languageNameFromBlock(block));
  return commentChars.length === 1 ? commentChars[0] : undefined;
}

export interface CommentReflow {
  /** The replaced line (0-based, relative to the cell body). */
  line: number;
  /** Replacement lines. */
  newLines: string[];
}

interface WrappableComment {
  indent: string;
  prefix: string;
  content: string;
}

/**
 * Split the full-line comments in a cell body that extend past the given
 * column. Each long comment line is wrapped greedily onto continuation lines
 * that repeat its indentation and comment prefix. Lines are only ever split,
 * never joined, and lines that aren't split are never rewritten.
 *
 * Only comments of the form `<prefix> <text>` are wrapped: lines where the
 * prefix runs straight into other characters (`#!/usr/bin/env bash`,
 * `#--- foo`), Quarto option directives (`#| echo: false`), empty comment
 * lines, divider/banner lines without any word content (`# ------`,
 * `#######`), section headers ending in a run of `-`/`=` (`# Load data ----`),
 * and lines that mix code and a trailing comment are all left verbatim.
 *
 * Returns one replacement per line that was split.
 */
export function reflowComments(
  cellLines: string[],
  comment: string,
  column: number
): CommentReflow[] {
  const optionPattern = optionCommentPattern(comment);
  // An extended comment prefix: one or more repetitions of the comment
  // string, optionally followed by a doc-comment marker. This keeps prefixes
  // like `#'` (roxygen), `///` and `//!` (doc comments) intact when wrapping.
  const prefixPattern = new RegExp("^((?:" + escapeRegExp(comment) + ")+[!'/]?)");

  const parseLine = (raw: string): WrappableComment | undefined => {
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith(comment)) {
      return undefined;
    }
    // Never touch cell option directives (`#| echo: false`)
    if (optionPattern.test(trimmed)) {
      return undefined;
    }
    const indent = raw.slice(0, raw.length - trimmed.length);
    const prefix = prefixPattern.exec(trimmed)![1];
    const rest = trimmed.slice(prefix.length);
    if (rest !== "" && !/^[ \t]/.test(rest)) {
      // The prefix runs straight into other characters (`#!/usr/bin/env`,
      // `#--- foo`): leave the line verbatim.
      return undefined;
    }
    const content = rest.trim();
    if (content === "") {
      return undefined;
    }
    if (!/[\p{L}\p{N}]/u.test(content) || /[-=]{4,}$/.test(content)) {
      // Dividers (`# ----`) and section headers (`# Load ----`)
      return undefined;
    }
    return { indent, prefix, content };
  };

  const reflows: CommentReflow[] = [];
  cellLines.forEach((raw, line) => {
    if (raw.length <= column) {
      return;
    }
    const parsed = parseLine(raw);
    if (!parsed) {
      return;
    }
    const newLines = wrapComment(parsed, column);
    // A single wrapped line means nothing was split (e.g. one unbreakable
    // word, or only trailing whitespace past the column): leave it verbatim.
    if (newLines.length > 1) {
      reflows.push({ line, newLines });
    }
  });
  return reflows;
}

function wrapComment(comment: WrappableComment, column: number): string[] {
  const linePrefix = comment.indent + comment.prefix + " ";
  const width = Math.max(1, column - linePrefix.length);
  const words = comment.content.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += " " + word;
    } else {
      out.push(linePrefix + current);
      current = word;
    }
  }
  if (current !== "") {
    out.push(linePrefix + current);
  }
  return out;
}
