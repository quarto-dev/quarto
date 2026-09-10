/*
 * cell-symbols.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import {
  commands,
  DocumentSymbol,
  Range,
  SymbolKind,
  Uri,
} from "vscode";

/**
 * One code cell's symbols, as answered by
 * `positron.executeQuartoCellSymbolProvider`.
 */
export interface QuartoCellSymbols {
  /** The cell's code span in source coordinates, fences excluded. */
  readonly range: Range;

  /** Already in source coordinates. Never empty. */
  readonly symbols: DocumentSymbol[];
}

/**
 * The symbols of every code cell in a Quarto document, grouped by cell.
 *
 * One request for the whole document, so callers walking a symbol tree should
 * ask once and then look cells up by range with {@link nestCellSymbols}.
 *
 * Answers `[]` for every unservable state: a host without the command, a
 * document with no cells, and a document whose cells have no language server
 * attached yet. That last case is why the caller must gate on
 * `useNativeEmbeddedFeatures()` rather than treat an empty answer as a reason to
 * fall back, and it needs no retry: when a server does register, the editor
 * re-requests document symbols on its own.
 */
export async function quartoCellSymbols(
  uri: Uri
): Promise<QuartoCellSymbols[]> {
  try {
    const cells = await commands.executeCommand<QuartoCellSymbols[] | undefined>(
      "positron.executeQuartoCellSymbolProvider",
      uri
    );
    return cells ?? [];
  } catch (error) {
    return [];
  }
}

/**
 * Whether a symbol tree holds any chunk symbol for a cell to nest under.
 *
 * The language server marks chunks with `SymbolKind.Function` (its `toc.ts`),
 * and drops every one of them when `quarto.symbols.showCodeCellsInOutline` is
 * off. A `_quarto.yml`, which this client's document selector also covers, never
 * has one either. In both cases {@link nestCellSymbols} would have nothing to
 * attach to, so the caller can answer without asking the host for cell symbols.
 */
export function hasChunkSymbols(symbols: readonly DocumentSymbol[]): boolean {
  return symbols.some(
    (symbol) =>
      symbol.kind === SymbolKind.Function || hasChunkSymbols(symbol.children)
  );
}

/**
 * Nests each cell's symbols under the chunk symbol it came from.
 *
 * Chunks are matched to cells by range containment: a chunk symbol's range
 * covers its fences, so the cell's code span sits inside it. Chunks are the
 * `SymbolKind.Function` symbols the Quarto language server's `toc.ts` emits,
 * which is the same marker the virtual document path uses.
 *
 * Symbols the language server already nested under a chunk are kept, and a
 * chunk with no matching cell is left as it is.
 */
export function nestCellSymbols(
  symbols: DocumentSymbol[],
  cells: readonly QuartoCellSymbols[]
): DocumentSymbol[] {
  for (const symbol of symbols) {
    if (symbol.kind === SymbolKind.Function) {
      const cell = cells.find((candidate) =>
        symbol.range.contains(candidate.range)
      );
      if (cell) {
        symbol.children = [...symbol.children, ...cell.symbols];
      }
    } else {
      symbol.children = nestCellSymbols(symbol.children, cells);
    }
  }

  return symbols;
}
