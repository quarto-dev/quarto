/*
 * codelens.ts
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

import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  Event,
  EventEmitter,
  ProviderResult,
  Range,
  TextDocument,
} from "vscode";

import { MarkdownEngine } from "../../markdown/engine";
import { countSections } from "./count";
import { formatWordCount, wordCountEnabled, wordCountOptions } from "./config";

export class WordCountCodeLensProvider implements CodeLensProvider {
  private readonly onDidChangeCodeLensesEmitter = new EventEmitter<void>();
  public readonly onDidChangeCodeLenses: Event<void> =
    this.onDidChangeCodeLensesEmitter.event;

  constructor(private readonly engine: MarkdownEngine) {}

  // refresh lenses (e.g. when the configuration changes)
  public refresh() {
    this.onDidChangeCodeLensesEmitter.fire();
  }

  public dispose() {
    this.onDidChangeCodeLensesEmitter.dispose();
  }

  public provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): ProviderResult<CodeLens[]> {
    if (!wordCountEnabled()) {
      return [];
    }

    const tokens = this.engine.parse(document);
    if (token.isCancellationRequested) {
      return [];
    }

    const sections = countSections(tokens, document.getText(), wordCountOptions());
    return sections.map((section) => {
      const range = new Range(section.line, 0, section.line, 0);
      return new CodeLens(range, {
        title: formatWordCount(section.words),
        tooltip: "Words in this section (including nested subsections)",
        command: "",
      });
    });
  }
}
