/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Hover, ServerCapabilities } from "vscode-languageserver/node";

import { yamlHover } from "./hover-yaml";
import { mathHover } from "./hover-math";
import { refHover } from "./hover-ref";

export const kHoverCapabilities: ServerCapabilities = {
  hoverProvider: true,
};

export async function onHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  return (
    refHover(doc, pos) || mathHover(doc, pos) || (await yamlHover(doc, pos))
  );
}
