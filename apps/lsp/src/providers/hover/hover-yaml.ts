/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Hover } from "vscode-languageserver/node";

import { editorContext, quarto } from "../../quarto/quarto";

export async function yamlHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  // bail if no quarto connection
  if (!quarto?.getHover) {
    return null;
  }
  try {
    const context = editorContext(doc, pos, true);
    const result = await quarto.getHover(context);
    if (result === null) {
      return null;
    }
    return {
      contents: {
        kind: "markdown",
        value: result.content,
      },
      range: result.range,
    };
  } catch {
    return null;
  }
}
