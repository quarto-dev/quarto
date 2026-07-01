/*
 * xref.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export const kXRefIndexForFile = 'xref_index_for_file';
export const kXRefXRefForId = 'xref_xref_for_id';
export const kXRefQuartoIndexForFile = 'xref_quarto_index_for_file';
export const kXRefQuartoXRefForId = 'xref_quarto_xref_for_id';

export interface XRefServer {
  indexForFile: (file: string) => Promise<XRefs>;
  xrefForId: (file: string, id: string) => Promise<XRefs>;
  quartoIndexForFile: (file: string) => Promise<XRefs>;
  quartoXrefForId: (file: string, id: string) => Promise<XRefs>;
}

export interface XRefs {
  baseDir: string;
  refs: XRef[];
}

export interface XRef {
  file: string;
  type: string;
  id: string;
  suffix: string;
  title?: string;
}

export function isXRef(x: unknown): x is XRef {
  return typeof x === "object" && !!(x as XRef).type;
}

export type XRefType = "quarto" | "bookdown";

