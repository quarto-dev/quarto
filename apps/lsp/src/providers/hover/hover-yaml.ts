/*
 * hover-yaml.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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
