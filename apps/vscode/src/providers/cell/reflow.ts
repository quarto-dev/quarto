/*
 * reflow.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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
import { escapeRegExp, langCommentChars, optionCommentPattern } from "./options";

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

    const cellLines = lines(codeForExecutableLanguageBlock(block, false));
    const reflows = reflowComments(cellLines, comment, column);
    if (reflows.length === 0) {
      return;
    }

    // Use the document's line ending to avoid introducing mixed EOL in CRLF files.
    const eol = document.eol === EndOfLine.CRLF ? "\r\n" : "\n";

    // The `+ 1` skips the opening fence line.
    const lineOffset = block.range.start.line + 1;

    await editor.edit((editBuilder) => {
      // Sort by descending start position to avoid range shifting issues
      [...reflows]
        .sort((a, b) => b.startLine - a.startLine)
        .forEach((reflow) => {
          const range = new Range(
            new Position(lineOffset + reflow.startLine, 0),
            document.lineAt(lineOffset + reflow.endLine).range.end
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
  /** First line of the replaced region (0-based, relative to the cell body). */
  startLine: number;
  /** Last line of the replaced region (inclusive). */
  endLine: number;
  /** Replacement lines (may be fewer or more than the region spans). */
  newLines: string[];
}

interface ParsedCommentLine {
  raw: string;
  indent: string;
  prefix: string;
  content: string;
  kind: "blank" | "fixed" | "text";
}

/**
 * Reflow the full-line comments in a cell body to the given column.
 *
 * Consecutive comment lines form paragraphs whose words are re-wrapped
 * greedily. Paragraphs are delimited by code lines, empty comment lines
 * (which are preserved as separators), changes in indentation or comment
 * prefix, and "fixed" lines that are kept verbatim: divider/banner lines
 * without any word content (`# ------`, `#######`) and section headers
 * ending in a run of `-`/`=` (`# Load data ----`). Quarto option directives
 * (`#| echo: false`) and lines that mix code and a trailing comment are
 * never touched.
 *
 * Returns one replacement per contiguous comment run that actually changed.
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

  const parseLine = (raw: string): ParsedCommentLine | undefined => {
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith(comment)) {
      return undefined;
    }
    // Never touch cell option directives (`#| echo: false`)
    if (optionPattern.test(trimmed)) {
      return undefined;
    }
    const indent = raw.slice(0, raw.length - trimmed.length);
    let prefix = prefixPattern.exec(trimmed)![1];
    let rest = trimmed.slice(prefix.length);
    if (rest !== "" && !/^[ \t]/.test(rest)) {
      // The extended prefix runs straight into other text (e.g. `#--- foo`):
      // fall back to the bare comment string as the prefix.
      prefix = comment;
      rest = trimmed.slice(comment.length);
    }
    const content = rest.trim();
    const kind =
      content === ""
        ? prefix === comment
          ? "blank"
          : "fixed" // banner lines like `#####` are kept verbatim
        : !/[\p{L}\p{N}]/u.test(content) || /[-=]{4,}$/.test(content)
          ? "fixed" // dividers (`# ----`) and section headers (`# Load ----`)
          : "text";
    return { raw, indent, prefix, content, kind };
  };

  const reflows: CommentReflow[] = [];
  let i = 0;
  while (i < cellLines.length) {
    if (!parseLine(cellLines[i])) {
      i++;
      continue;
    }
    // Collect a contiguous run of comment lines
    const runStart = i;
    const run: ParsedCommentLine[] = [];
    for (; i < cellLines.length; i++) {
      const parsed = parseLine(cellLines[i]);
      if (!parsed) {
        break;
      }
      run.push(parsed);
    }
    const runEnd = i - 1;
    const newLines = reflowRun(run, column);
    const original = cellLines.slice(runStart, runEnd + 1);
    if (
      newLines.length !== original.length ||
      newLines.some((line, idx) => line !== original[idx])
    ) {
      reflows.push({ startLine: runStart, endLine: runEnd, newLines });
    }
  }
  return reflows;
}

function reflowRun(run: ParsedCommentLine[], column: number): string[] {
  const out: string[] = [];
  let paragraph: ParsedCommentLine[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      out.push(...wrapParagraph(paragraph, column));
      paragraph = [];
    }
  };
  for (const line of run) {
    if (line.kind === "blank") {
      flush();
      // Normalize empty comment lines (drops trailing whitespace)
      out.push(line.indent + line.prefix);
    } else if (line.kind === "fixed") {
      flush();
      out.push(line.raw);
    } else {
      if (
        paragraph.length > 0 &&
        (paragraph[0].indent !== line.indent || paragraph[0].prefix !== line.prefix)
      ) {
        flush();
      }
      paragraph.push(line);
    }
  }
  flush();
  return out;
}

function wrapParagraph(paragraph: ParsedCommentLine[], column: number): string[] {
  const linePrefix = paragraph[0].indent + paragraph[0].prefix + " ";
  const width = Math.max(1, column - linePrefix.length);
  const words = paragraph
    .flatMap((line) => line.content.split(/\s+/))
    .filter((word) => word.length > 0);
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
