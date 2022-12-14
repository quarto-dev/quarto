/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Hover, Position, Range } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { bypassRefIntelligence } from "../../core/refs";
import { biblioRefs, CslRef } from "../../core/biblio";

// cache the last ref lookup
let lastRef: CslRef | undefined;

export function refHover(doc: TextDocument, pos: Position): Hover | null {
  // compute the line
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();

  // bypass?
  if (bypassRefIntelligence(doc, pos, line)) {
    return null;
  }

  // scan back from the cursor for an '@'
  const text = line.slice(0, pos.character);
  const atPos = text.lastIndexOf("@");
  if (atPos !== -1) {
    const citeText = line.slice(atPos);
    const citeMatch = citeText.match(/^@[^@;\[\]\s\!\,]+/);
    if (citeMatch) {
      const citeId = citeMatch[0].replace(/\.$/, "").slice(1);
      const range = Range.create(
        pos.line,
        atPos,
        pos.line,
        atPos + citeId.length + 1
      );
      if (citeId === lastRef?.id && lastRef.cite) {
        return hoverFromCslRef(lastRef.cite, range);
      } else {
        const refs = biblioRefs(doc);
        if (refs) {
          const ref = refs.find((x) => x.id === citeId);
          if (ref?.cite) {
            lastRef = ref;
            return hoverFromCslRef(ref.cite, range);
          }
        }
      }
    }
  }

  return null;
}

function hoverFromCslRef(cite: string, range: Range): Hover {
  return {
    contents: {
      kind: "markdown",
      value: cite,
    },
    range,
  };
}
