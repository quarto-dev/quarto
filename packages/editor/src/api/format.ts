/*
 * format.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export interface EditorFormat {
  readonly pandocMode: string;
  readonly pandocExtensions: string;
  readonly rmdExtensions: EditorRmdExtensions;
  readonly hugoExtensions: EditorHugoExtensions;
  readonly docTypes: EditorExtendedDocType[];
}

export interface EditorRmdExtensions {
  readonly codeChunks?: boolean;
  readonly bookdownXRef?: boolean;
  readonly bookdownXRefUI?: boolean;
  readonly bookdownPart?: boolean;
  readonly blogdownMathInCode?: boolean;
}

export interface EditorHugoExtensions {
  readonly shortcodes?: boolean;
}

export const kBookdownDocType = 'bookdown';
export const kHugoDocType = 'hugo';
export const kQuartoDocType = 'quarto';
export const kPresentationDocType = 'presentation';

export type EditorExtendedDocType = 'bookdown' | 'hugo' | 'quarto' | 'presentation';
