/*
 * vdoc.ts
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

import Token from "markdown-it/lib/token";
import { Position, TextDocument, Uri, Range } from "vscode";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import {
  isExecutableLanguageBlock,
  languageBlockAtPosition,
  languageNameFromBlock,
} from "../markdown/language";
import { embeddedLanguage, EmbeddedLanguage } from "./languages";
import { virtualDocUriFromEmbeddedContent } from "./vdoc-content";
import { virtualDocUriFromTempFile } from "./vdoc-tempfile";

export interface VirtualDoc {
  language: EmbeddedLanguage;
  content: string;
}

export async function virtualDoc(
  document: TextDocument,
  position: Position,
  engine: MarkdownEngine
): Promise<VirtualDoc | undefined> {
  // make sure this is a quarto doc
  if (!isQuartoDoc(document)) {
    return undefined;
  }

  // check if the cursor is in a fenced code block
  const tokens = await engine.parse(document);
  const language = languageAtPosition(tokens, position);

  if (language) {
    // filter out lines that aren't of this language
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push(language.emptyLine || "");
    }
    for (const languageBlock of tokens.filter(isBlockOfLanguage(language))) {
      if (languageBlock.map) {
        for (
          let line = languageBlock.map[0] + 1;
          line < languageBlock.map[1] - 1 && line < document.lineCount;
          line++
        ) {
          lines[line] = document.lineAt(line).text;
        }
      }
    }

    // perform inject if necessary
    if (language.inject) {
      lines.unshift(...language.inject);
    }

    // return the language and the content
    return {
      language,
      content: lines.join("\n"),
    };
  } else {
    return undefined;
  }
}

export async function virtualDocUri(virtualDoc: VirtualDoc, parentUri: Uri) {
  return virtualDoc.language.type === "content"
    ? virtualDocUriFromEmbeddedContent(virtualDoc, parentUri)
    : await virtualDocUriFromTempFile(virtualDoc);
}

export function languageAtPosition(tokens: Token[], position: Position) {
  const block = languageBlockAtPosition(tokens, position);
  if (block) {
    return languageFromBlock(block);
  } else {
    return undefined;
  }
}

export function languageFromBlock(token: Token) {
  const name = languageNameFromBlock(token);
  return embeddedLanguage(name);
}

export function isBlockOfLanguage(language: EmbeddedLanguage) {
  return (token: Token) => {
    return (
      isExecutableLanguageBlock(token) &&
      languageFromBlock(token)?.ids.some((id) => language.ids.includes(id))
    );
  };
}

// adjust position for inject
export function adjustedPosition(language: EmbeddedLanguage, pos: Position) {
  return new Position(pos.line + (language.inject?.length || 0), pos.character);
};

export function unadjustedPosition(language: EmbeddedLanguage, pos: Position) {
  return new Position(pos.line - (language.inject?.length || 0), pos.character);
};

export function unadjustedRange(language: EmbeddedLanguage, range: Range) {
  return new Range(
    unadjustedPosition(language, range.start),
    unadjustedPosition(language, range.end)
  );
};
