/*
 * hover-yaml.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Hover, MarkupKind } from "vscode-languageserver";

import { EditorContext } from "../../quarto";
import { Quarto } from "../../../quarto";

export async function yamlHover(quarto: Quarto, context: EditorContext): Promise<Hover | null> {
  // bail if no quarto connection
  if (!quarto?.getHover) {
    return null;
  }
  try {
    const result = await quarto.getHover(context);
    if (result === null) {
      return null;
    }
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: result.content,
      },
      range: result.range,
    };
  } catch {
    return null;
  }
}
