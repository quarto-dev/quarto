/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  window,
  workspace,
  ExtensionContext,
  Position,
  TextEditor,
  Range,
} from "vscode";
import { isQuartoDoc } from "../core/doc";

import { MarkdownEngine } from "../markdown/engine";
import {
  languageBlockAtPosition,
  languageNameFromBlock,
} from "../markdown/language";

export function activateOptionEnterProvider(
  context: ExtensionContext,
  engine: MarkdownEngine
) {
  workspace.onDidChangeTextDocument(
    async (event) => {
      if (window.activeTextEditor) {
        // if we are in an active quarto doc with an empty selection
        const doc = window.activeTextEditor.document;
        if (
          doc.uri === event.document.uri &&
          isQuartoDoc(doc) &&
          window.activeTextEditor.selection.isEmpty
        ) {
          // check for enter key within a language block
          for (const change of event.contentChanges) {
            if (change.text === "\n" || change.text === "\r\n") {
              const tokens = await engine.parse(doc);
              const line = window.activeTextEditor.selection.start.line;
              const block = languageBlockAtPosition(
                tokens,
                new Position(line, 0)
              );
              if (block) {
                const language = languageNameFromBlock(block);
                // handle option enter for the this langauge if we can
                const optionComment = languageOptionComment(language);
                if (optionComment) {
                  handleOptionEnter(window.activeTextEditor, optionComment);
                }
              }
            }
          }
        }
      }
    },
    null,
    context.subscriptions
  );
}

function handleOptionEnter(editor: TextEditor, comment: string) {
  // option comment for this language
  const optionComment = comment + "| ";

  // get current line
  const currentLineNumber = editor.selection.active.line;
  const currentLine = editor.document
    .getText(new Range(currentLineNumber, 0, currentLineNumber + 1, 0))
    .trim();

  // if the current line is empty then we might qualify for some auto insert/delete
  if (currentLine.length === 0) {
    // get the previous line
    const previousLine = editor.document
      .getText(new Range(currentLineNumber - 1, 0, currentLineNumber, 0))
      .trim();
    if (previousLine.trim() === optionComment.trim()) {
      // previous line is an empty option comment -- remove the comment
      editor.edit((builder) => {
        builder.replace(
          new Range(
            new Position(editor.selection.active.line - 1, 0),
            new Position(editor.selection.active.line, 0)
          ),
          "\n"
        );
      });
    } else if (previousLine.startsWith(optionComment)) {
      // previous line starts with option comment -- start this line with a comment
      editor.edit((builder) => {
        builder.insert(editor.selection.end!, optionComment);
      });
    }
  }
}

function languageOptionComment(langauge: string) {
  if (Object.keys(kLangCommentChars).includes(langauge)) {
    return kLangCommentChars[langauge];
  } else {
    return undefined;
  }
}

const kLangCommentChars: Record<string, string> = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  powershell: "#",
  bash: "#",
  sql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  mermaid: "%%",
};
