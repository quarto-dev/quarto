/*
 * hover-math.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2016 James Yu
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

import { Hover, MarkupContent, MarkupKind, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { MathjaxTypesetOptions } from "editor-types";
import { mathjaxTypeset } from "editor-server";

import { mathRange } from "../../core/markdown";
import { ConfigurationManager } from "../../config";


export function mathHover(config: ConfigurationManager) {
  
  return (doc: TextDocument, pos: Position): Hover | null => {
    const range = mathRange(doc, pos);
    if (range) {
      const contents = mathjaxTypesetToMarkdown(range.math, doc.getText(), config);
      if (contents) {
        return {
          contents,
          range: range.range,
        };
      }
    }
    return null;
  }
}

function mathjaxTypesetToMarkdown(
  tex: string, 
  docText: string,
  config: ConfigurationManager
) :  MarkupContent | null  {
  const settings = config.getSettings();
  const options: MathjaxTypesetOptions = {
    format: "data-uri",
    theme: settings?.workbench.colorTheme.includes("Light") ? "light" : "dark",
    scale: settings?.quarto.mathjax.scale || 1,
    extensions: settings?.quarto.mathjax.extensions || []
  }
  const result = mathjaxTypeset(tex, options, docText);
  if (result.math) {
    return {
      kind: MarkupKind.Markdown,
      value: `![equation](${result.math})`,
    };
  } else {
    return {
      kind: MarkupKind.Markdown,
      value: `**LaTeX Error**:\n" + ${result.error || "Unknown error"}`,
    };
  }
}

