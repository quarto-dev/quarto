/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { MarkdownTextDocument } from "../markdown/document";
import { MarkdownEngine } from "../markdown/engine";
import {
  MarkdownTableOfContents,
  TocEntry,
  TocEntryType,
} from "../markdown/toc";

interface MarkdownSymbol {
  readonly level: number;
  readonly parent: MarkdownSymbol | undefined;
  readonly children: vscode.DocumentSymbol[];
}

export default class QuartoDocumentSymbolProvider
  implements vscode.DocumentSymbolProvider
{
  constructor(private readonly engine: MarkdownEngine) {}

  public async provideDocumentSymbolInformation(
    document: MarkdownTextDocument
  ): Promise<vscode.SymbolInformation[]> {
    const toc = await MarkdownTableOfContents.create(this.engine, document);
    return toc.entries.map((entry) => this.toSymbolInformation(entry));
  }

  public async provideDocumentSymbols(
    document: MarkdownTextDocument
  ): Promise<vscode.DocumentSymbol[]> {
    const toc = await MarkdownTableOfContents.create(this.engine, document);
    const root: MarkdownSymbol = {
      level: -Infinity,
      children: [],
      parent: undefined,
    };
    this.buildTree(root, toc.entries);
    return root.children;
  }

  private buildTree(parent: MarkdownSymbol, entries: readonly TocEntry[]) {
    if (!entries.length) {
      return;
    }

    const entry = entries[0];
    const symbol = this.toDocumentSymbol(entry);
    symbol.children = [];

    while (parent && entry.level <= parent.level) {
      parent = parent.parent!;
    }
    parent.children.push(symbol);
    this.buildTree(
      { level: entry.level, children: symbol.children, parent },
      entries.slice(1)
    );
  }

  private toSymbolInformation(entry: TocEntry): vscode.SymbolInformation {
    return new vscode.SymbolInformation(
      this.getSymbolName(entry),
      this.tocEntrySymbolKind(entry),
      "",
      entry.location
    );
  }

  private toDocumentSymbol(entry: TocEntry) {
    return new vscode.DocumentSymbol(
      this.getSymbolName(entry),
      "",
      this.tocEntrySymbolKind(entry),
      entry.location.range,
      entry.location.range
    );
  }

  private getSymbolName(entry: TocEntry): string {
    return entry.text || " ";
  }

  private tocEntrySymbolKind(entry: TocEntry): vscode.SymbolKind {
    switch (entry.type) {
      case TocEntryType.Title: {
        return vscode.SymbolKind.File;
      }
      case TocEntryType.Heading: {
        return vscode.SymbolKind.Constant;
      }
      case TocEntryType.CodeCell: {
        return vscode.SymbolKind.Function;
      }
    }
  }
}
