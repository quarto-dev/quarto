/*
 * option.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

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
import { languageBlockAtPosition, languageNameFromBlock } from "quarto-core";


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
              const tokens = engine.parse(doc);
              const line = window.activeTextEditor.selection.start.line;
              const block = languageBlockAtPosition(
                tokens,
                new Position(line, 0)
              );
              if (block) {
                const language = languageNameFromBlock(block);
                // handle option enter for the this language if we can
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

  // current line info
  const currentLineNumber = editor.selection.active.line;
  const currentLine = editor.document.lineAt(editor.selection.start).text;

  // apply edits
  if (currentLine.trim() === optionComment.trim()) {
    editor.edit((builder) => {
      builder.delete(new Range(new Position(currentLineNumber, 0), new Position(currentLineNumber, currentLine.length)));
    });
  } else if (currentLine.startsWith(optionComment)) {
    editor.edit((builder) => {
      builder.insert(editor.selection.start.translate(1, -editor.selection.active.character), optionComment);
    });
  }
}

function languageOptionComment(language: string) {
  // some mappings
  if (language === "ojs") {
    language = "js";
  }

  if (Object.keys(kLangCommentChars).includes(language)) {
    return kLangCommentChars[language];
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
  prql: "#",
};
