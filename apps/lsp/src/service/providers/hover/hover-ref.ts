/*
 * hover-ref.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Hover, Position, Range } from "vscode-languageserver";
import { cslRefs, CslRef } from "editor-server";

import { bypassRefIntelligence, citeAtPosition } from "../../util/refs";

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

  // find the citation under the cursor
  const cite = citeAtPosition(line, pos.character);
  if (cite) {
    const citeId = cite.id;
    const range = Range.create(pos.line, cite.start, pos.line, cite.end);
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
