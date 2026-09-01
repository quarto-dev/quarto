/*
 * document.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as vscode from "vscode";

import { isFrontMatter, parseFrontMatterStr, partitionYamlFrontMatter } from "quarto-core";
import { MarkdownEngine } from "./engine";
import { isJupyterPercentScript, isKnitrSpinScript, markdownFromJupyterPercentScript } from "core-node";

export interface MarkdownTextLine {
  text: string;
}

export interface MarkdownTextDocument {
  readonly uri: vscode.Uri;
  readonly version: number;
  readonly lineCount: number;

  lineAt(line: number): MarkdownTextLine;
  getText(): string;
}

export function documentFrontMatterYaml(
  engine: MarkdownEngine,
  doc: vscode.TextDocument
) {
  // if its a script we need to extract the front matter
  if (isJupyterPercentScript(doc.uri.fsPath, doc.getText())) {
    const markdown = markdownFromJupyterPercentScript(doc.uri.fsPath, doc.getText(), 1);
    const partitioned = partitionYamlFrontMatter(markdown);
    return partitioned?.yaml || '';
  } else if (isKnitrSpinScript(doc.uri.fsPath, doc.getText())) {
    // TODO: extract markdown from spin script
    return '';
  } else {
    const tokens = engine.parse(doc);
    const yaml = tokens.find(isFrontMatter);
    if (yaml) {
      return yaml.data;
    } else {
      return '';
    }
  }
}

export function documentFrontMatter(
  engine: MarkdownEngine,
  doc: vscode.TextDocument
): Record<string, unknown> {
  const yaml = documentFrontMatterYaml(engine, doc);
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml);
    if (frontMatter && typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}
