/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) 2016 James Yu
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Hover, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { mathRange } from "../../core/markdown/markdown";
import { mathjaxTypesetToMarkdown } from "../../core/mathjax";

export function mathHover(doc: TextDocument, pos: Position): Hover | null {
  const range = mathRange(doc, pos);
  if (range) {
    defineNewCommands(doc.getText());
    const contents = mathjaxTypesetToMarkdown(range.math);
    if (contents) {
      return {
        contents,
        range: range.range,
      };
    }
  }
  return null;
}

// newcommand macros we have already typeset
const newCommandsDefined = new Set<string>();
function defineNewCommands(content: string) {
  // define any commands that haven't beeen already
  for (const command of newCommands(content)) {
    if (!newCommandsDefined.has(command)) {
      mathjaxTypesetToMarkdown(command);
      newCommandsDefined.add(command);
    }
  }
}

// based on https://github.com/James-Yu/LaTeX-Workshop/blob/b5ea2a626be7d4e5a2ebe0ec93a4012f42bf931a/src/providers/preview/mathpreviewlib/newcommandfinder.ts#L92
function* newCommands(content: string) {
  const regex =
    /(\\(?:(?:(?:(?:re)?new|provide)command|DeclareMathOperator)(\*)?{\\[a-zA-Z]+}(?:\[[^[\]{}]*\])*{.*})|\\(?:def\\[a-zA-Z]+(?:#[0-9])*{.*})|\\DeclarePairedDelimiter{\\[a-zA-Z]+}{[^{}]*}{[^{}]*})/gm;
  const noCommentContent = stripComments(content);
  let result: RegExpExecArray | null;
  do {
    result = regex.exec(noCommentContent);
    if (result) {
      let command = result[1];
      if (result[2]) {
        command = command.replace(/\*/, "");
      }
      yield command;
    }
  } while (result);
}

function stripComments(text: string): string {
  const reg = /(^|[^\\]|(?:(?<!\\)(?:\\\\)+))%.*$/gm;
  return text.replace(reg, "$1");
}
