/*
 * mathjax.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 * 
 * Copyright (c) 2016 James Yu
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// based on https://github.com/James-Yu/LaTeX-Workshop/tree/master/src/providers/preview

// These import the physical `mjs/` paths rather than the `js/*` export, which
// `moduleResolution: node` doesn't understand
import { mathjax } from "@mathjax/src/mjs/mathjax.js";
import { TeX } from "@mathjax/src/mjs/input/tex.js";
import { SVG } from "@mathjax/src/mjs/output/svg.js";
import { liteAdaptor } from "@mathjax/src/mjs/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/mjs/handlers/html.js";
import type { LiteElement } from "@mathjax/src/mjs/adaptors/lite/Element.js";
import type { MathDocument } from "@mathjax/src/mjs/core/MathDocument.js";
import type { LiteDocument } from "@mathjax/src/mjs/adaptors/lite/Document.js";
import type { LiteText } from "@mathjax/src/mjs/adaptors/lite/Text.js";
import type TexError from "@mathjax/src/mjs/input/tex/TexError.js";

// MathJax 4's default font (mathjax-newcm) loads glyph ranges on demand, which
// makes the synchronous convert() throw a retry error, and can't find its files
// once bundled. The MathJax TeX font (MathJax 3's font) is entirely static.
import { MathJaxTexFont } from "@mathjax/mathjax-tex-font/mjs/svg.js";
// The glyphs mhchem uses for its arrows are in a font extension
import { MathJaxMhchemFontExtension } from "@mathjax/mathjax-mhchem-font-extension/mjs/svg.js";

// TeX packages: baseExtensions and supportedExtensionList below
// (MathJax 4 has no AllPackages)
import "@mathjax/src/mjs/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/mjs/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/mjs/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/mjs/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/mjs/input/tex/noerrors/NoErrorsConfiguration.js";
import "@mathjax/src/mjs/input/tex/noundefined/NoUndefinedConfiguration.js";
import "@mathjax/src/mjs/input/tex/amscd/AmsCdConfiguration.js";
import "@mathjax/src/mjs/input/tex/bbox/BboxConfiguration.js";
import "@mathjax/src/mjs/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/mjs/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/mjs/input/tex/bussproofs/BussproofsConfiguration.js";
import "@mathjax/src/mjs/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/mjs/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/mjs/input/tex/centernot/CenternotConfiguration.js";
import "@mathjax/src/mjs/input/tex/colortbl/ColortblConfiguration.js";
import "@mathjax/src/mjs/input/tex/empheq/EmpheqConfiguration.js";
import "@mathjax/src/mjs/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/mjs/input/tex/extpfeil/ExtpfeilConfiguration.js";
import "@mathjax/src/mjs/input/tex/gensymb/GensymbConfiguration.js";
import "@mathjax/src/mjs/input/tex/html/HtmlConfiguration.js";
import "@mathjax/src/mjs/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/mjs/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/mjs/input/tex/physics/PhysicsConfiguration.js";
import "@mathjax/src/mjs/input/tex/textcomp/TextcompConfiguration.js";
import "@mathjax/src/mjs/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/mjs/input/tex/unicode/UnicodeConfiguration.js";
import "@mathjax/src/mjs/input/tex/upgreek/UpgreekConfiguration.js";
import "@mathjax/src/mjs/input/tex/verb/VerbConfiguration.js";

import { MathjaxSupportedExtension, MathjaxTypesetOptions, MathjaxTypesetResult } from "editor-types";

type TexOption = {
  packages?: readonly MathjaxSupportedExtension[];
  inlineMath?: readonly [string, string][];
  displayMath?: readonly [string, string][];
  processEscapes?: boolean;
  processEnvironments?: boolean;
  processRefs?: boolean;
  tags?: "all" | "ams" | "none";
  tagSide?: "right" | "left";
  tagIndent?: string;
  useLabelIds?: boolean;
  maxMacros?: number;
  maxBuffer?: number;
  baseURL?: string;
  formatError?: (
    jax: TeX<LiteElement, LiteText, LiteDocument>,
    message: TexError
  ) => unknown;
};

type SvgOption = {
  scale?: number;
  minScale?: number;
  mtextInheritFont?: boolean;
  merrorInheritFont?: boolean;
  mathmlSpacing?: boolean;
  skipAttributes?: { [attrname: string]: boolean };
  exFactor?: number;
  displayAlign?: "left" | "center" | "right";
  displayIndent?: number;
  fontCache?: "local" | "global" | "none";
  fontData?: typeof MathJaxTexFont;
  internalSpeechTitles?: boolean;
};

 type ConvertOption = {
  display?: boolean;
  em?: number;
  ex?: number;
  containerWidth?: number;
  lineWidth?: number;
  scale?: number;
};

export function mathjaxTypeset(tex: string, options: MathjaxTypesetOptions, docText?: string): MathjaxTypesetResult {
  
  // if docText is specified then first define any commands found therin
  if (docText) {
    defineNewCommands(docText, options);
  }

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
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return { error: message };
  }
}

export function mathjaxLoadedExtensions(extensionConfig: readonly MathjaxSupportedExtension[]) {
  ensureExtensionsLoaded(extensionConfig);
  return loadedExtensions;
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
  // Serialize as XML: MathJax 4 records the source TeX in data-latex attributes,
  // and HTML serialization leaves any `<` in them unescaped, which makes the SVG
  // invalid as an image
  let svgHtml = adaptor.serializeXML(adaptor.firstChild(node) as LiteElement);
  svgHtml = svgHtml
    .replace(/<defs\/>/, "<defs></defs>")
    .replace(/<defs>/, `<defs><style>${css}</style>`);
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


const baseExtensions: MathjaxSupportedExtension[] = [
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
MathJaxTexFont.addExtension(MathJaxMhchemFontExtension);
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
let loadedExtensions = baseExtensions;
let html = createHtmlConverter(loadedExtensions);

function ensureExtensionsLoaded(extensions: readonly string[]) {
  // if the extension list doesn't match exactly then reload it
  const targetExtensions = baseExtensions.concat(
    extensions.filter((ex) => supportedExtensionList.includes(ex)) as MathjaxSupportedExtension[]
  );
  if (targetExtensions.length !== loadedExtensions.length ||
      !targetExtensions.every((v, i) => v === loadedExtensions[i])) {
    loadedExtensions = targetExtensions;
    html = createHtmlConverter(loadedExtensions);
  }
}

function createHtmlConverter(extensions: MathjaxSupportedExtension[]) {
  const baseTexOption: TexOption = {
    packages: extensions,
    formatError: (_jax, error) => {
      throw new Error(error.message);
    },
  };
  const texInput = new TeX<LiteElement, LiteText, LiteDocument>(baseTexOption);
  const svgOption: SvgOption = { fontCache: "local", fontData: MathJaxTexFont };
  const svgOutput = new SVG<LiteElement, LiteText, LiteDocument>(svgOption);
  return mathjax.document("", {
    InputJax: texInput,
    OutputJax: svgOutput,
  }) as MathDocument<LiteElement, LiteText, LiteDocument>;
}


// defining commands from elewhere in the document
// newcommand macros we have already typeset
const newCommandsDefined = new Set<string>();
function defineNewCommands(content: string, options: MathjaxTypesetOptions) {
  // define any commands that haven't beeen already
  for (const command of newCommands(content)) {
    if (!newCommandsDefined.has(command)) {
      // called purely for its side effect of making the command
      // available to subsequent user facing math typesetting
      mathjaxTypeset(command, options);
      newCommandsDefined.add(command);
    }
  }
}

// based on https://github.com/James-Yu/LaTeX-Workshop/blob/b5ea2a626be7d4e5a2ebe0ec93a4012f42bf931a/src/providers/preview/mathpreviewlib/newcommandfinder.ts#L92
function* newCommands(content: string) {
  const regex =
    /(\\(?:(?:(?:(?:re)?new|provide)command|DeclareMathOperator)(\*)?{\\[a-zA-Z]+}(?:\[[^[\]{}]*\])*{.*})|\\(?:def\\[a-zA-Z]+(?:#[0-9])*{.*})|\\DeclarePairedDelimiter{\\[a-zA-Z]+}{[^{}]*}{[^{}]*})/gm;
  const noCommentContent = stripComments(content);
  let result: RegExpExecArray | null;
  do {
    result = regex.exec(noCommentContent);
    if (result) {
      let command = result[1];
      if (result[2]) {
        command = command.replace(/\*/, "");
      }
      yield command;
    }
  } while (result);
}

function stripComments(text: string): string {
  const reg = /(^|[^\\]|(?:(?<!\\)(?:\\\\)+))%.*$/gm;
  return text.replace(reg, "$1");
}
