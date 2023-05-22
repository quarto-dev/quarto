/*
 * doc.ts
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

import { URI } from "vscode-uri";

import { TextDocument } from "vscode-languageserver-textdocument";
import { ITextDocument } from "..";

export const kQuartoLanguageId = "quarto";
export const kMarkdownLanguageId = "markdown";
export const kYamlLanguageId = "yaml";

export enum DocType {
  None,
  Qmd,
  Yaml,
}

export function docType(doc: TextDocument) {
  if (isQuartoDoc(doc)) {
    return DocType.Qmd;
  } else if (isQuartoYaml(doc)) {
    return DocType.Yaml;
  } else {
    return DocType.None;
  }
}

export function isQuartoDoc(doc: ITextDocument) {
  return (
    doc.languageId === kQuartoLanguageId ||
    doc.languageId === kMarkdownLanguageId
  );
}

export function isQuartoYaml(doc: ITextDocument) {
  return (
    doc.languageId === kYamlLanguageId &&
    (doc.uri.match(/_quarto(-.*?)?\.ya?ml$/) ||
      doc.uri.match(/_metadata\.ya?ml$/) ||
      doc.uri.match(/_extension\.ya?ml$/))
  );
}

export function filePathForDoc(doc: ITextDocument) {
  return URI.parse(doc.uri).fsPath;
}

const kRegExYAML =
  /(^)(---[ \t]*[\r\n]+(?![ \t]*[\r\n]+)[\W\w]*?[\r\n]+(?:---|\.\.\.))([ \t]*)$/gm;

export function isQuartoRevealDoc(doc: TextDocument | string) {
  if (typeof(doc) !== "string") {
    if (isQuartoDoc(doc)) {
      doc = doc.getText();
    } else {
      return false;
    }
  }
  if (doc) {
    const match = doc.match(kRegExYAML);
    if (match) {
      const yaml = match[0];
      return (
        !!yaml.match(/^format:\s+revealjs\s*$/gm) ||
        !!yaml.match(/^[ \t]*revealjs:\s*(default)?\s*$/gm)
      );
    }
  }
}

