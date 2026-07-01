/*
 * preview-util.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import semver from "semver";

import vscode from "vscode";
import { TextDocument, Uri, workspace } from "vscode";

import {
  projectDirForDocument,
  metadataFilesForDocument,
  yamlFromMetadataFile,
} from "quarto-core";
import { isNotebook } from "../../core/doc";

import { MarkdownEngine } from "../../markdown/engine";
import { documentFrontMatter } from "../../markdown/document";
import { isKnitrDocument } from "../../host/executors";
import { getRenderOnSave, getRenderOnSaveShiny } from "../context-keys";


export function isQuartoShinyDoc(
  engine: MarkdownEngine,
  doc?: TextDocument
) {
  if (doc) {
    const frontMatter = documentFrontMatter(engine, doc);
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

export function isQuartoShinyKnitrDoc(
  engine: MarkdownEngine,
  doc?: TextDocument
) {
  return doc && isQuartoShinyDoc(engine, doc) && isKnitrDocument(doc, engine);

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
  const docYaml = documentFrontMatter(engine, document);
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
        if (yaml) {
          const projSetting = readRenderOnSave(yaml);
          if (projSetting !== undefined) {
            return projSetting;
          }
        }
      }
    }
  }

  // finally, consult configuration
  return !isQuartoShinyDoc(engine, document)
    ? getRenderOnSave()
    : getRenderOnSaveShiny();
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
