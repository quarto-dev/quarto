/*
 * hover-math.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2016 James Yu
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

import { Hover, MarkupContent, MarkupKind, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { MathjaxTypesetOptions } from "editor-types";
import { mathjaxTypeset } from "editor-server";

import { config } from "../../core/config";
import { mathRange } from "../../core/markdown";


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

function mathjaxTypesetToMarkdown(tex: string) :  MarkupContent | null  {
  const options: MathjaxTypesetOptions = {
    format: "data-uri",
    theme: config.mathJaxTheme(),
    scale: config.mathJaxScale(),
    extensions: config.mathJaxExtensions()
  }
  const result = mathjaxTypeset(tex, options);
  if (result.math) {
    return {
      kind: MarkupKind.Markdown,
      value: `![equation](${result.math})`,
    };
  } else {
    return {
      kind: MarkupKind.Markdown,
      value: `**LaTeX Error**:\n" + ${result.error || "Unknown error"}`,
    };
  }
}

