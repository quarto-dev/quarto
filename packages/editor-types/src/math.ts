/*
 * math.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


export const kMathMathjaxTypesetSvg = 'math_mathjax_typeset_svg';

export interface MathjaxTypesetOptions {
  format: "svg" | "data-uri";
  theme: "light" | "dark";
  scale: number;
  extensions: readonly MathjaxSupportedExtension[];
}

export interface MathjaxTypesetResult {
  math?: string;
  error?: string;
}

export type MathjaxSupportedExtension =
  | "action"
  | "ams"
  | "amscd"
  | "autoload"
  | "base"
  | "bbox"
  | "boldsymbol"
  | "braket"
  | "bussproofs"
  | "cancel"
  | "cases"
  | "centernot"
  | "color"
  | "colortbl"
  | "colorv2"
  | "configmacros"
  | "empheq"
  | "enclose"
  | "extpfeil"
  | "gensymb"
  | "html"
  | "mathtools"
  | "mhchem"
  | "newcommand"
  | "noerrors"
  | "noundefined"
  | "physics"
  | "require"
  | "setoptions"
  | "tagformat"
  | "textcomp"
  | "textmacros"
  | "unicode"
  | "upgreek"
  | "verb";


export interface MathServer {
  mathjaxTypeset: (math: string, options: MathjaxTypesetOptions, docPath: string | null) => Promise<MathjaxTypesetResult>;
}

