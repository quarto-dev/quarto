/*
 * mathjax.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * 
 * Copyright (c) 2016 James Yu
 * Licensed under the MIT License. See LICENSE in the project root for license information.
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

// based on https://github.com/James-Yu/LaTeX-Workshop/tree/master/src/providers/preview

import type {
  ConvertOption,
  SupportedExtension,
  SvgOption,
  TexOption,
} from "mathjax-full";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import type { MathDocument } from "mathjax-full/js/core/MathDocument.js";
import type { LiteDocument } from "mathjax-full/js/adaptors/lite/Document.js";
import type { LiteText } from "mathjax-full/js/adaptors/lite/Text.js";
import "mathjax-full/js/input/tex/AllPackages.js";

import { MathjaxTypesetOptions, MathjaxTypesetResult } from "editor-types";

export function mathjaxTypeset(tex: string, options: MathjaxTypesetOptions): MathjaxTypesetResult {
  
  // reload extensions as required
  ensureExtensionsLoaded(options.extensions);
  
  // remove crossref if necessary
  tex = tex.replace(/\$\$\s+\{#eq[\w-]+\}\s*$/, "");

  const typesetOpts = {
    scale: options.scale,
    color: getColor(options),
  };
  try {
    const svg = typesetToSvg(tex, typesetOpts);
    if (options.format === "svg") {
      return { math: svg };
    } else if (options.format === "data-uri" ) {
      return { math: svgToDataUrl(svg) }
    } else {
      return { error: `Unkown format ${options.format}`};
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
}

function typesetToSvg(
  arg: string,
  opts: { scale: number; color: string }
): string {
  const convertOption: ConvertOption = {
    display: true,
    em: 18,
    ex: 9,
    containerWidth: 80 * 18,
  };
  const node = html.convert(arg, convertOption) as LiteElement;

  const css = `svg {font-size: ${100 * opts.scale}%;} * { color: ${
    opts.color
  } }`;
  let svgHtml = adaptor.innerHTML(node);
  svgHtml = svgHtml.replace(/<defs>/, `<defs><style>${css}</style>`);
  return svgHtml;
}

function getColor(options: MathjaxTypesetOptions) {
  const lightness = options.theme;
  if (lightness === "light") {
    return "#000000";
  } else {
    return "#ffffff";
  }
}

function svgToDataUrl(xml: string): string {
  // We have to call encodeURIComponent and unescape because SVG can includes non-ASCII characters.
  // We have to encode them before converting them to base64.
  const svg64 = Buffer.from(
    unescape(encodeURIComponent(xml)),
    "binary"
  ).toString("base64");
  const b64Start = "data:image/svg+xml;base64,";
  return b64Start + svg64;
}


const baseExtensions: SupportedExtension[] = [
  "ams",
  "base",
  "color",
  "newcommand",
  "noerrors",
  "noundefined",
];

const supportedExtensionList = [
  "amscd",
  "bbox",
  "boldsymbol",
  "braket",
  "bussproofs",
  "cancel",
  "cases",
  "centernot",
  "colortbl",
  "empheq",
  "enclose",
  "extpfeil",
  "gensymb",
  "html",
  "mathtools",
  "mhchem",
  "physics",
  "textcomp",
  "textmacros",
  "unicode",
  "upgreek",
  "verb",
];


// some globals
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
let loadedExtensions = baseExtensions;
let html = createHtmlConverter(loadedExtensions);

function ensureExtensionsLoaded(extensions: string[]) {
  // if the extension list doesn't match exactly then reload it
  const targetExtensions = baseExtensions.concat(
    extensions.filter((ex) => supportedExtensionList.includes(ex)) as SupportedExtension[]
  );
  if (targetExtensions.length !== loadedExtensions.length ||
      !targetExtensions.every((v, i) => v === loadedExtensions[i])) {
    loadedExtensions = targetExtensions;
    html = createHtmlConverter(loadedExtensions);
  }
}

function createHtmlConverter(extensions: SupportedExtension[]) {
  const baseTexOption: TexOption = {
    packages: extensions,
    formatError: (_jax, error) => {
      throw new Error(error.message);
    },
  };
  const texInput = new TeX<LiteElement, LiteText, LiteDocument>(baseTexOption);
  const svgOption: SvgOption = { fontCache: "local" };
  const svgOutput = new SVG<LiteElement, LiteText, LiteDocument>(svgOption);
  return mathjax.document("", {
    InputJax: texInput,
    OutputJax: svgOutput,
  }) as MathDocument<LiteElement, LiteText, LiteDocument>;
}
