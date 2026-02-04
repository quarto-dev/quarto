/*
 * yaml-links.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import {
  CancellationToken,
  DocumentLink,
  DocumentLinkProvider,
  ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument,
  Uri,
  workspace,
} from "vscode";

import { isQuartoYaml } from "../core/doc";

const FILE_EXTENSIONS = ['qmd', 'scss', 'css', 'html', 'js', 'bib', 'tex', 'md'];
const IGNORE_PATTERNS = ['.git', 'node_modules', '_site', '_freeze', '.quarto'];

export function activateYamlLinks(context: ExtensionContext) {
  const config = workspace.getConfiguration("quarto");

  if (config.get<boolean>("yaml.documentLinks.enabled", true)) {
    context.subscriptions.push(
      languages.registerDocumentLinkProvider(
        { language: "yaml", scheme: "file" },
        new QuartoYamlLinkProvider()
      )
    );
  }
}

class QuartoYamlLinkProvider implements DocumentLinkProvider {
  provideDocumentLinks(
    document: TextDocument,
    _token: CancellationToken
  ): DocumentLink[] {
    if (!isQuartoYaml(document)) {
      return [];
    }

    const links: DocumentLink[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    const documentDir = path.dirname(document.uri.fsPath);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineLinks = this.findLinksInLine(line, lineIndex, documentDir);
      links.push(...lineLinks);
    }

    return links;
  }

  private findLinksInLine(
    line: string,
    lineIndex: number,
    documentDir: string
  ): DocumentLink[] {
    const links: DocumentLink[] = [];

    // Match file paths in YAML values
    // Pattern: looks for paths after ': ' or '- ' that end with known extensions
    const extensionPattern = FILE_EXTENSIONS.join('|');
    const regex = new RegExp(
      `(?:^\\s*-\\s*|:\\s*)([\\w./-]+\\.(?:${extensionPattern}))`,
      'gi'
    );

    let match;
    while ((match = regex.exec(line)) !== null) {
      const filePath = match[1];
      const startIndex = match.index + match[0].length - filePath.length;
      const endIndex = startIndex + filePath.length;

      // Resolve the full path
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(documentDir, filePath);

      // Check if the file exists
      if (fs.existsSync(fullPath)) {
        const range = new Range(
          new Position(lineIndex, startIndex),
          new Position(lineIndex, endIndex)
        );

        const link = new DocumentLink(
          range,
          Uri.file(fullPath)
        );
        link.tooltip = `Open ${filePath}`;
        links.push(link);
      }
    }

    return links;
  }
}
