/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Uri } from "vscode";
import { extname } from "./path";
export const kQuartoLanguageId = "quarto";
export const kMarkdownLanguageId = "markdown";
const kMermaidLanguageId = "mermaid";
const kDotLanguageId = "dot";
const kYamlLanguageId = "yaml";

export const kQuartoDocSelector: vscode.DocumentSelector = {
  language: kQuartoLanguageId,
  scheme: "*",
};

export function isQuartoDoc(doc?: vscode.TextDocument) {
  return (
    isLanguageDoc(kQuartoLanguageId, doc) ||
    isLanguageDoc(kMarkdownLanguageId, doc)
  );
}

export function isMermaidDoc(doc?: vscode.TextDocument) {
  return isLanguageDoc(kMermaidLanguageId, doc);
}

export function isGraphvizDoc(doc?: vscode.TextDocument) {
  return isLanguageDoc(kDotLanguageId, doc);
}

function isLanguageDoc(languageId: string, doc?: vscode.TextDocument) {
  return !!doc && doc.languageId === languageId;
}

export function isNotebook(doc?: vscode.TextDocument) {
  return !!doc && isNotebookUri(doc.uri);
}

export function isNotebookUri(uri: Uri) {
  return extname(uri.fsPath).toLowerCase() === ".ipynb";
}

export function isQuartoYaml(doc?: vscode.TextDocument) {
  return (
    !!doc &&
    doc.languageId === kYamlLanguageId &&
    doc.uri.toString().match(/_quarto\.ya?ml$/)
  );
}

export function isMarkdownDoc(document?: vscode.TextDocument) {
  return (
    !!document && (isQuartoDoc(document) || document.languageId === "markdown")
  );
}

export function validatateQuartoExtension(document: vscode.TextDocument) {
  const ext = extname(document.uri.toString()).toLowerCase();
  return [".qmd", ".rmd", ".md"].includes(ext);
}

export async function resolveQuartoDocUri(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  try {
    const doc = await tryResolveUriToQuartoDoc(resource);
    if (doc) {
      return doc;
    }
  } catch {
    // Noop
  }

  // If no extension, try with `.qmd` extension
  if (extname(resource.path) === "") {
    return tryResolveUriToQuartoDoc(
      resource.with({ path: resource.path + ".qmd" })
    );
  }

  return undefined;
}

export function getWholeRange(doc: vscode.TextDocument) {
  const begin = new vscode.Position(0, 0);
  const end = doc.lineAt(doc.lineCount - 1).range.end;
  return new vscode.Range(begin, end);
}

export function preserveEditorFocus(editor?: vscode.TextEditor) {
  // focus the editor (sometimes the terminal steals focus)
  editor = editor || vscode.window.activeTextEditor;
  if (editor) {
    if (!isNotebook(editor?.document)) {
      setTimeout(() => {
        if (editor) {
          vscode.window.showTextDocument(
            editor.document,
            editor.viewColumn,
            false
          );
        }
      }, 200);
    }
  }
}

export function findEditor(
  filter: (doc: vscode.TextDocument) => boolean,
  includeVisible = true
) {
  const activeDoc = vscode.window.activeTextEditor?.document;
  if (activeDoc && filter(activeDoc)) {
    return vscode.window.activeTextEditor;
  } else if (includeVisible) {
    const visibleEditor = vscode.window.visibleTextEditors.find((editor) =>
      filter(editor.document)
    );
    if (visibleEditor) {
      return visibleEditor;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

async function tryResolveUriToQuartoDoc(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(resource);
  } catch {
    return undefined;
  }
  if (isQuartoDoc(document)) {
    return document;
  }
  return undefined;
}
