/*
 * source.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export const kSourceGetSourcePosLocations = 'source_get_source_pos_locations';


export type SourcePosBlock = "Para" | "Header" | "CodeBlock" | "Div" | "BulletList" | "OrderedList" | "RawBlock" | "BlockQuote" | "HorizontalRule";

export interface SourcePosLocation {
  block: SourcePosBlock;
  pos: number; // could be a line number or a prosemirror pos
}

export interface SourcePos {
  locations: SourcePosLocation[];
  pos: number;  // could be a line number or a prosemirror pos
}

export function isSourcePos(x: unknown): x is SourcePos {
  return typeof x === "object" && !!(x as SourcePos).locations;
}


export interface SourceServer {
  getSourcePosLocations: (markdown: string) => Promise<SourcePosLocation[]>;
}


