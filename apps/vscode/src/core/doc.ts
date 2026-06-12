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

import path from "node:path";
import fs from "node:fs";

import * as vscode from "vscode";
import { Uri } from "vscode";
import { revealSlideIndex } from "../markdown/reveal";
import { QuartoVisualEditor, VisualEditorProvider } from "../providers/editor/editor";
import { extname } from "./path";
import { MarkdownEngine } from "../markdown/engine";
import { QuartoContext, projectDirForDocument } from "quarto-core";
import { workspace } from "vscode";
import { isJupyterPercentScript, isKnitrSpinScript } from "core-node";

export const kQuartoLanguageId = "quarto";
export const kMarkdownLanguageId = "markdown";
const kMermaidLanguageId = "mermaid";
const kDotLanguageId = "dot";
const kYamlLanguageId = "yaml";

export const kQuartoDocSelector: vscode.DocumentSelector = {
  language: kQuartoLanguageId,
  scheme: "*",
};

export function isQuartoDoc(doc?: vscode.TextDocument, strict = false) {
  return (
    isLanguageDoc(kQuartoLanguageId, doc) ||
    (!strict && isLanguageDoc(kMarkdownLanguageId, doc))
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

export function isNotebookCell(doc?: vscode.TextDocument) {
  return !!doc && isIpynbUri(doc.uri);
}

function isNotebookDoc(doc?: vscode.TextDocument | vscode.NotebookDocument): doc is vscode.NotebookDocument {
  return !!doc && 'notebookType' in doc;
}

function isIpynbUri(uri: Uri) {
  return extname(uri.fsPath).toLowerCase() === ".ipynb";
}

export function canPreviewDoc(doc?: vscode.TextDocument | vscode.NotebookDocument) {
  if (doc) {
    if (isNotebookDoc(doc)) {
      return isIpynbUri(doc.uri);
    } else if (isQuartoDoc(doc)) {
      return true;
    } else if (validatateQuartoCanRender(doc)) {
      return true;
    }
  }
  return false;
}

export function previewDirForDocument(uri: Uri) {
  // first check for a quarto project
  const projectDir = projectDirForDocument(uri.fsPath);
  if (projectDir) {
    return projectDir;
  } else {
    // now check if we are within a workspace root
    const workspaceDir = workspace.getWorkspaceFolder(uri);
    if (workspaceDir) {
      return workspaceDir.uri.fsPath;
    }
  }
  return undefined;
}

export function previewTargetDir(uri: Uri) {
  const targetPath = uri.fsPath;
  if (fs.statSync(targetPath).isDirectory()) {
    return targetPath;
  } else {
    return path.dirname(targetPath);
  }
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

export function quartoCanRenderMarkdown(document: vscode.TextDocument) {
  const ext = extname(document.uri.toString()).toLowerCase();
  return [".qmd", ".rmd", ".md"].includes(ext);
}

export function quartoCanRenderScript(document: vscode.TextDocument) {
  const text = document.getText();
  return isJupyterPercentScript(document.uri.fsPath, text) ||
    isKnitrSpinScript(document.uri.fsPath, text);
}

export function validatateQuartoCanRender(document: vscode.TextDocument) {
  return quartoCanRenderMarkdown(document) || quartoCanRenderScript(document);
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
  editor =
    editor ||
    (vscode.window.activeTextEditor
      ? quartoTextEditor(vscode.window.activeTextEditor)
      : undefined);
  if (editor) {
    if (!isQuartoNotebookEditor(editor)) {
      setTimeout(() => {
        if (editor) {
          editor.activate();
        }
      }, 200);
    }
  } else {
    // see if there is a visual editor we should be preserving focus for
    const visualEditor = VisualEditorProvider.activeEditor();
    if (visualEditor) {
      setTimeout(async () => {
        if (!(await visualEditor.hasFocus())) {
          await visualEditor.activate();
        }
      }, 200);
    }
  }
}

export type QuartoEditor = QuartoTextEditor | QuartoNotebookEditor | QuartoVisualEditor;

export interface QuartoEditorBase {
  document: vscode.TextDocument;
  activate: () => Promise<void>;
  viewColumn?: vscode.ViewColumn;
  slideIndex?: () => Promise<number>;
}

export interface QuartoTextEditor extends QuartoEditorBase {
  type: 'text';
  textEditor: vscode.TextEditor;
}

export interface QuartoNotebookEditor extends QuartoEditorBase {
  type: 'notebook';
  notebook: vscode.NotebookDocument;
}

export function isQuartoNotebookEditor(editor: QuartoEditor): editor is QuartoNotebookEditor {
  return editor.type === 'notebook';
}

export function isQuartoTextEditor(editor: QuartoEditor): editor is QuartoTextEditor {
  return editor.type === 'text';
}

export function isQuartoVisualEditor(editor: QuartoEditor): editor is QuartoVisualEditor {
  return editor.type === 'visual';
}

export function findQuartoEditor(
  engine: MarkdownEngine,
  context: QuartoContext,
  filter: (doc: vscode.TextDocument | vscode.NotebookDocument) => boolean,
): QuartoEditor | undefined {
  // first check for an active visual editor
  const activeVisualEditor = VisualEditorProvider.activeEditor();
  if (activeVisualEditor && filter(activeVisualEditor.document)) {
    return activeVisualEditor;
  }

  // then check for active notebook editor
  const notebookEditor = vscode.window.activeNotebookEditor;
  if (notebookEditor && filter(notebookEditor.notebook)) {
    // TODO: Why is cellAt always defined?...
    const firstCellDoc = notebookEditor.notebook.cellAt(0)?.document;
    if (firstCellDoc) {
      return quartoNotebookEditor(notebookEditor, firstCellDoc);
    }
  }

  // active text editor
  const textEditor = vscode.window.activeTextEditor;
  if (textEditor && filter(textEditor.document)) {
    return quartoTextEditor(textEditor, engine, context);
    // check visible text editors
  } else {
    // visible visual editor (sometime it loses track of 'active' so we need to use 'visible')
    const visibleVisualEditor = VisualEditorProvider.activeEditor(true);
    if (visibleVisualEditor && filter(visibleVisualEditor.document)) {
      return visibleVisualEditor;
    }

    // visible text editors
    const visibleEditor = vscode.window.visibleTextEditors.find((editor) =>
      filter(editor.document)
    );
    if (visibleEditor) {
      return quartoTextEditor(visibleEditor, engine, context);
    } else {
      return undefined;
    }
  }
}

function quartoTextEditor(
  editor: vscode.TextEditor,
  engine?: MarkdownEngine,
  context?: QuartoContext,
): QuartoTextEditor {
  return {
    type: 'text',
    document: editor.document,
    activate: async () => {
      await vscode.window.showTextDocument(
        editor.document,
        editor.viewColumn,
        false
      );
    },
    slideIndex: async () => {
      if (engine && context) {
        return await revealSlideIndex(
          editor.selection.active,
          editor.document,
          engine,
          context
        );
      } else {
        return 0;
      }
    },
    viewColumn: editor.viewColumn,
    textEditor: editor,
  };
}

function quartoNotebookEditor(
  notebookEditor: vscode.NotebookEditor,
  firstCellDoc: vscode.TextDocument,
): QuartoNotebookEditor {
  return {
    type: 'notebook',
    document: firstCellDoc,
    activate: async () => {
      await vscode.window.showNotebookDocument(
        notebookEditor.notebook,
        { viewColumn: notebookEditor.viewColumn, preserveFocus: false }
      );
    },
    viewColumn: notebookEditor.viewColumn,
    notebook: notebookEditor.notebook,
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
