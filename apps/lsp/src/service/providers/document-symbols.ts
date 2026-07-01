/*
 * document-symbols.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */
import { CancellationToken } from 'vscode-languageserver';
import * as lsp from 'vscode-languageserver-types';
import { isBefore, makeRange, Document } from 'quarto-core';
import { ILogger } from '../logging';
import { MdTableOfContentsProvider, TableOfContents, TocEntry, TocEntryType } from '../toc';
import { MdLinkDefinition, MdLinkKind, MdLinkProvider } from './document-links';
import { LsConfiguration } from '../config';

interface MarkdownSymbol {
  readonly level: number;
  readonly parent: MarkdownSymbol | undefined;
  readonly children: lsp.DocumentSymbol[];
  readonly range: lsp.Range;
}

export interface ProvideDocumentSymbolOptions {
  readonly includeLinkDefinitions?: boolean;
}

export class MdDocumentSymbolProvider {

  readonly #tocProvider: MdTableOfContentsProvider;
  readonly #linkProvider: MdLinkProvider;
  readonly #logger: ILogger;
  readonly #config: LsConfiguration;

  constructor(
    config: LsConfiguration,
    tocProvider: MdTableOfContentsProvider,
    linkProvider: MdLinkProvider,
    logger: ILogger,
  ) {
    this.#config = config;
    this.#tocProvider = tocProvider;
    this.#linkProvider = linkProvider;
    this.#logger = logger;
  }

  public async provideDocumentSymbols(document: Document, options: ProvideDocumentSymbolOptions, token: CancellationToken): Promise<lsp.DocumentSymbol[]> {
    this.#logger.logDebug('DocumentSymbolProvider.provideDocumentSymbols', { document: document.uri, version: document.version });

    if (token.isCancellationRequested) {
      return [];
    }

    const linkSymbols = await (options.includeLinkDefinitions ? this.#provideLinkDefinitionSymbols(document, token) : []);
    if (token.isCancellationRequested) {
      return [];
    }

    const toc = await this.#tocProvider.getForDocument(document);
    if (token.isCancellationRequested) {
      return [];
    }

    return this.#toSymbolTree(document, linkSymbols, toc);
  }

  #toSymbolTree(document: Document, linkSymbols: readonly lsp.DocumentSymbol[], toc: TableOfContents): lsp.DocumentSymbol[] {
    const root: MarkdownSymbol = {
      level: -Infinity,
      children: [],
      parent: undefined,
      range: makeRange(0, 0, document.lineCount + 1, 0),
    };
    const additionalSymbols = [...linkSymbols];

    // Filter out TOC entries based on configuration
    const filteredEntries = toc.entries.filter(entry => {
      // Always exclude title entries
      if (entry.type === TocEntryType.Title) {
        return false;
      }
      // Exclude all code cells if the setting is disabled
      if (entry.type === TocEntryType.CodeCell && !this.#config.showCodeCellsInOutline) {
        return false;
      }
      return true;
    });

    this.#buildTocSymbolTree(root, filteredEntries, additionalSymbols);
    // Put remaining link definitions into top level document instead of last header
    root.children.push(...additionalSymbols);
    return root.children;
  }

  async #provideLinkDefinitionSymbols(document: Document, token: CancellationToken): Promise<lsp.DocumentSymbol[]> {
    const { links } = await this.#linkProvider.getLinks(document);
    if (token.isCancellationRequested) {
      return [];
    }

    return links
      .filter(link => link.kind === MdLinkKind.Definition)
      .map((link): lsp.DocumentSymbol => this.#definitionToDocumentSymbol(link as MdLinkDefinition));
  }

  #definitionToDocumentSymbol(def: MdLinkDefinition): lsp.DocumentSymbol {
    return {
      kind: lsp.SymbolKind.Constant,
      name: `[${def.ref.text}]`,
      selectionRange: def.ref.range,
      range: def.source.range,
    };
  }

  #buildTocSymbolTree(parent: MarkdownSymbol, entries: readonly TocEntry[], additionalSymbols: lsp.DocumentSymbol[]): void {
    if (entries.length) {
      while (additionalSymbols.length && isBefore(additionalSymbols[0].range.end, entries[0].sectionLocation.range.start)) {
        parent.children.push(additionalSymbols.shift()!);
      }
    }

    if (!entries.length) {
      return;
    }

    const entry = entries[0];
    const symbol = this.#tocToDocumentSymbol(entry);
    symbol.children = [];

    while (entry.level <= parent.level) {
      parent = parent.parent!;
    }
    parent.children.push(symbol);

    this.#buildTocSymbolTree({ level: entry.level, children: symbol.children, parent, range: entry.sectionLocation.range }, entries.slice(1), additionalSymbols);
  }

  #tocToDocumentSymbol(entry: TocEntry): lsp.DocumentSymbol {
    return {
      name: this.#getTocSymbolName(entry),
      kind: this.#getTocSymbolKind(entry),
      range: entry.sectionLocation.range,
      selectionRange: entry.sectionLocation.range
    };
  }

  #getTocSymbolKind(entry: TocEntry): lsp.SymbolKind {
    switch (entry.type) {
      case TocEntryType.Title: {
        return lsp.SymbolKind.File;
      }
      case TocEntryType.Header: {
        return lsp.SymbolKind.Constant;
      }
      case TocEntryType.CodeCell: {
        return lsp.SymbolKind.Function;
      }
    }
  }

  #getTocSymbolName(entry: TocEntry): string {
    return entry.text || " ";
  }
}
