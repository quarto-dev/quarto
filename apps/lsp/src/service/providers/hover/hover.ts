/*
 * hover.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Position } from "vscode-languageserver-textdocument";
import { CancellationToken, Hover } from "vscode-languageserver";

import { yamlHover } from "./hover-yaml";
import { mathHover } from "./hover-math";
import { refHover } from "./hover-ref";
import { Document, Parser } from "quarto-core";
import { LsConfiguration } from "../../config";
import { Quarto } from "../../../quarto";
import { docEditorContext } from "../../quarto";
import { IWorkspace } from "../../workspace";

export class MdHoverProvider {
  constructor(private readonly workspace_: IWorkspace, private readonly quarto_: Quarto, private readonly parser_: Parser) { }

  public async provideHover(
    doc: Document,
    pos: Position,
    config: LsConfiguration,
    token: CancellationToken
  ): Promise<Hover | null> {
    if (token.isCancellationRequested) {
      return null;
    }
    return (
      (await refHover(this.quarto_, this.parser_, doc, pos)) ||
      mathHover(this.parser_, doc, pos, config) ||
      (await yamlHover(this.quarto_, docEditorContext(doc, pos, true)))

      // there appears to be a size cap on markdown images (somewhere around 75k)
      // so we have switched this back to the client-side. note also that if we
      // bring this back we need to make it work for more than just png files
      // || (await (imageHover(this.workspace_)(doc, pos))

    );
  }
}
