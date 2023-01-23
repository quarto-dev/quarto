/*
 * preview-util.ts
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

import semver from "semver";

import vscode from "vscode";
import { TextDocument, Uri, workspace } from "vscode";

import {
  projectDirForDocument,
  metadataFilesForDocument,
  yamlFromMetadataFile,
} from "quarto-core";
import { isNotebook, quartoEditor, QuartoEditor } from "../../core/doc";
import { VisualEditorProvider } from "../editor/editor";

import { MarkdownEngine } from "../../markdown/engine";
import { documentFrontMatter } from "../../markdown/document";


export function findEditor(
  filter: (doc: vscode.TextDocument) => boolean,
  includeVisible = true
) : QuartoEditor | undefined {

  // first check for an active visual editor
  const activeVisualEditor = VisualEditorProvider.activeEditor();
  if (activeVisualEditor && filter(activeVisualEditor.document)) {
    return activeVisualEditor;
  }

  // active text editor
  const textEditor = vscode.window.activeTextEditor;
  if (textEditor && filter(textEditor.document)) {
    return quartoEditor(textEditor);
  // check visible text editors
  } else if (includeVisible) {
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
      return quartoEditor(visibleEditor);
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
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

export async function isQuartoShinyDoc(
  engine: MarkdownEngine,
  doc?: TextDocument
) {
  if (doc) {
    const frontMatter = await documentFrontMatter(engine, doc);
    if (frontMatter["server"] === "shiny") {
      return true;
    } else {
      if (typeof frontMatter["server"] === "object") {
        return (
          (frontMatter["server"] as Record<string, unknown>)["type"] === "shiny"
        );
      }
    }
    return false;
  } else {
    return false;
  }
}


export async function renderOnSave(engine: MarkdownEngine, document: TextDocument) {
  // if its a notebook and we don't have a save hook for notebooks then don't
  // allow renderOnSave (b/c we can't detect the saves)
  if (isNotebook(document) && !haveNotebookSaveEvents()) {
    return false;
  }

  // notebooks automatically get renderOnSave
  if (isNotebook(document)) {
    return true;
  }

  // first look for document level editor setting
  const docYaml = await documentFrontMatter(engine, document);
  const docSetting = readRenderOnSave(docYaml);
  if (docSetting !== undefined) {
    return docSetting;
  }

  // now project level (take the first metadata file with a setting)
  const projectDir = projectDirForDocument(document.uri.fsPath);
  if (projectDir) {
    const metadataFiles = metadataFilesForDocument(document.uri.fsPath);
    if (metadataFiles) {
      for (const metadataFile of metadataFiles) {
        const yaml = yamlFromMetadataFile(metadataFile);
        const projSetting = readRenderOnSave(yaml);
        if (projSetting !== undefined) {
          return projSetting;
        }
      }
    }
  }

  // finally, consult vs code settings
  const render =
    workspace.getConfiguration("quarto").get<boolean>("render.renderOnSave") ||
    false;
  return render;
}

export function haveNotebookSaveEvents() {
  return (
    semver.gte(vscode.version, "1.67.0") &&
    !!(workspace as any).onDidSaveNotebookDocument
  );
}

function readRenderOnSave(yaml: Record<string, unknown>) {
  if (typeof yaml["editor"] === "object") {
    const yamlObj = yaml["editor"] as Record<string, unknown>;
    if (typeof yamlObj["render-on-save"] === "boolean") {
      return yamlObj["render-on-save"] as boolean;
    }
  }
  return undefined;
}
