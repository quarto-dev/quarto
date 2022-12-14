/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { URI } from "vscode-uri";

import { TextDocument } from "vscode-languageserver-textdocument";

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

export function isQuartoDoc(doc: TextDocument) {
  return (
    doc.languageId === kQuartoLanguageId ||
    doc.languageId === kMarkdownLanguageId
  );
}

export function isQuartoYaml(doc: TextDocument) {
  return (
    doc.languageId === kYamlLanguageId &&
    (doc.uri.match(/_quarto(-.*?)?\.ya?ml$/) ||
      doc.uri.match(/_metadata\.ya?ml$/) ||
      doc.uri.match(/_extension\.ya?ml$/))
  );
}

export function filePathForDoc(doc: TextDocument) {
  return URI.parse(doc.uri).fsPath;
}

const kRegExYAML =
  /(^)(---[ \t]*[\r\n]+(?![ \t]*[\r\n]+)[\W\w]*?[\r\n]+(?:---|\.\.\.))([ \t]*)$/gm;

export function isQuartoRevealDoc(doc: TextDocument) {
  if (isQuartoDoc(doc)) {
    const text = doc.getText();
    if (text) {
      const match = doc.getText().match(kRegExYAML);
      if (match) {
        const yaml = match[0];
        return (
          !!yaml.match(/^format\:\s+revealjs\s*$/gm) ||
          !!yaml.match(/^[ \t]*revealjs\:\s*(default)?\s*$/gm)
        );
      }
    }
  } else {
    return false;
  }
}
