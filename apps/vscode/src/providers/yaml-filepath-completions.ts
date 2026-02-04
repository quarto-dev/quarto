/*
 * yaml-filepath-completions.ts
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

import * as path from "path";

import { glob } from "glob";

import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument,
  workspace,
} from "vscode";

import { isQuartoYaml } from "../core/doc";

const FILE_EXTENSIONS = ['qmd', 'scss', 'css', 'html', 'js', 'bib', 'tex', 'md'];
const IGNORE_PATTERNS = ['.git', 'node_modules', '_site', '_freeze', '.quarto'];

export function activateYamlFilepathCompletions(context: ExtensionContext) {
  const config = workspace.getConfiguration("quarto");

  if (config.get<boolean>("yaml.filepathCompletions.enabled", true)) {
    context.subscriptions.push(
      languages.registerCompletionItemProvider(
        { language: "yaml", scheme: "file" },
        new QuartoYamlFilepathCompletionProvider(),
        "/", "." // Trigger on path separators
      )
    );
  }
}

class QuartoYamlFilepathCompletionProvider implements CompletionItemProvider {
  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
    _context: CompletionContext
  ): Promise<CompletionItem[]> {
    if (!isQuartoYaml(document)) {
      return [];
    }

    const line = document.lineAt(position).text;
    const linePrefix = line.substring(0, position.character);

    // Only provide completions after ': ' or '- '
    if (!this.shouldProvideCompletions(linePrefix)) {
      return [];
    }

    const documentDir = path.dirname(document.uri.fsPath);
    const projectFiles = await getProjectFiles(documentDir);

    // Get current input to filter completions
    const currentInput = this.getCurrentInput(linePrefix);

    return projectFiles
      .filter(file => file.toLowerCase().includes(currentInput.toLowerCase()))
      .map(file => {
        const item = new CompletionItem(file, CompletionItemKind.File);
        item.detail = "Quarto project file";
        item.insertText = file;

        // If there's existing input, replace it
        if (currentInput) {
          const startPos = position.character - currentInput.length;
          item.range = new Range(
            new Position(position.line, startPos),
            position
          );
        }

        return item;
      });
  }

  private shouldProvideCompletions(linePrefix: string): boolean {
    // Check if we're in a position where file path completions make sense
    // After ': ' for key-value pairs or after '- ' for list items
    return /(?::\s+|^\s*-\s+)\S*$/.test(linePrefix);
  }

  private getCurrentInput(linePrefix: string): string {
    // Extract the current partial input after ': ' or '- '
    const match = linePrefix.match(/(?::\s+|^\s*-\s+)(\S*)$/);
    return match ? match[1] : "";
  }
}

async function getProjectFiles(projectDir: string): Promise<string[]> {
  const extensionPattern = `**/*.{${FILE_EXTENSIONS.join(',')}}`;

  try {
    const files = await glob(extensionPattern, {
      cwd: projectDir,
      ignore: IGNORE_PATTERNS.map(p => `**/${p}/**`),
      nodir: true,
    });

    return files.sort();
  } catch {
    return [];
  }
}
