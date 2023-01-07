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

export function preserveEditorFocus(editor?: QuartoEditor) {
  // focus the editor (sometimes the terminal steals focus)
  editor = editor || (vscode.window.activeTextEditor ? quartoEditor(vscode.window.activeTextEditor) : undefined);
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

export interface QuartoEditor {
  document: vscode.TextDocument;
  activate: () => Promise<void>;
  viewColumn?: vscode.ViewColumn;
  textEditor?: vscode.TextEditor;
}

export function quartoEditor(editor: vscode.TextEditor) {
  return { 
    document: editor.document, 
    activate: async () => {
      await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    },
    viewColumn: editor.viewColumn, 
    textEditor: editor 
  };
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
