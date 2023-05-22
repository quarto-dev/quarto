/*
 * hover.ts
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

import { Position } from "vscode-languageserver-textdocument";
import { Hover } from "vscode-languageserver";

import { yamlHover } from "./hover-yaml";
import { mathHover } from "./hover-math";
import { refHover } from "./hover-ref";
import { ITextDocument } from "../../document";
import { LsConfiguration } from "../../config";
import { Quarto } from "../../quarto";
import { docEditorContext } from "../../quarto";

export class MdHoverProvider {
  constructor(private readonly quarto_: Quarto) {}

  public async provideHover(
    doc: ITextDocument,
    pos: Position,
    config?: LsConfiguration
  ): Promise<Hover | null> {
    return (
      (await refHover(this.quarto_, doc, pos)) ||  mathHover(doc, pos, config) || (await yamlHover(this.quarto_, docEditorContext(doc, pos, true)))
    );
  } 
}
