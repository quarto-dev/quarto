/*
 * hover-ref.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Hover, Position, Range } from "vscode-languageserver";
import { cslRefs, CslRef } from "editor-server";

import { bypassRefIntelligence } from "../../util/refs";

import { Document, Parser, filePathForDoc, documentFrontMatter } from "quarto-core";
import { Quarto } from "../../../quarto";


// cache the last ref lookup
let lastRef: CslRef | undefined;

export async function refHover(quarto: Quarto, parser: Parser, doc: Document, pos: Position): Promise<Hover | null> {
  // compute the line
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();

  // bypass?
  if (bypassRefIntelligence(parser, doc, pos, line)) {
    return null;
  }

  // scan back from the cursor for an '@'
  const text = line.slice(0, pos.character);
  const atPos = text.lastIndexOf("@");
  if (atPos !== -1) {
    const citeText = line.slice(atPos);
    const citeMatch = citeText.match(/^@[^@;[\]\s!,]+/);
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
        const refs = cslRefs(quarto, filePathForDoc(doc), documentFrontMatter(parser, doc));
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
