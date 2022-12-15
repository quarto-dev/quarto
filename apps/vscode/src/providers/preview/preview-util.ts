/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import semver from "semver";

import vscode from "vscode";
import { TextDocument, TextEditor, Uri, workspace } from "vscode";
import { parseFrontMatterStr } from "../../core/yaml";
import { MarkdownEngine } from "../../markdown/engine";
import {
  metadataFilesForDocument,
  yamlFromMetadataFile,
} from "quarto-core";
import { isNotebook } from "../../core/doc";

export function previewDirForDocument(uri: Uri) {
  // first check for a quarto project
  const projectDir = projectDirForDocument(uri);
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

export function projectDirForDocument(uri: Uri) {
  let dir = path.dirname(uri.fsPath);
  while (true) {
    if (hasQuartoProject(dir)) {
      return dir;
    } else {
      const nextDir = path.dirname(dir);
      if (nextDir !== dir) {
        dir = nextDir;
      } else {
        break;
      }
    }
  }
  return undefined;
}

export function hasQuartoProject(dir?: string) {
  if (dir) {
    return (
      fs.existsSync(path.join(dir, "_quarto.yml")) ||
      fs.existsSync(path.join(dir, "_quarto.yaml"))
    );
  } else {
    return false;
  }
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

export async function documentFrontMatter(
  engine: MarkdownEngine,
  doc: TextDocument
): Promise<Record<string, unknown>> {
  const tokens = await engine.parse(doc);
  const yaml = tokens.find((token) => token.type === "front_matter");
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.markup);
    if (typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}

export async function renderOnSave(engine: MarkdownEngine, editor: TextEditor) {
  // if its a notebook and we don't have a save hook for notebooks then don't
  // allow renderOnSave (b/c we can't detect the saves)
  if (isNotebook(editor.document) && !haveNotebookSaveEvents()) {
    return false;
  }

  // notebooks automatically get renderOnSave
  if (isNotebook(editor.document)) {
    return true;
  }

  // first look for document level editor setting
  const docYaml = await documentFrontMatter(engine, editor.document);
  const docSetting = readRenderOnSave(docYaml);
  if (docSetting !== undefined) {
    return docSetting;
  }

  // now project level (take the first metadata file with a setting)
  const projectDir = projectDirForDocument(editor.document.uri);
  if (projectDir) {
    const metadataFiles = metadataFilesForDocument(editor.document.uri.fsPath);
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
