/*
* headings.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import type MarkdownIt from "markdown-it/lib"
import Token from "markdown-it/lib/token"
import Renderer from "markdown-it/lib/renderer";
import { attributeDecorator } from "../utils/html";
import { addClass } from "../utils/markdownit";

export const headingsPlugin = (md: MarkdownIt) => {
  
  // Render pandoc-style divs
  function renderStartHeading(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, self: Renderer): string {

    const token = tokens[idx];

    // Compute a decorator
    const attrDecorator = attributeDecorator(token, "quarto-heading-attribute-decorator");

    // Add a class to designate that this is a quarto dev
    if (attrDecorator) {
      token.attrs = addClass("quarto-heading-decorated", token.attrs);
    }
    

    // Render the decorated heading
    return `${attrDecorator}${self.renderToken(tokens, idx, options)}`;
  }

  md.renderer.rules['heading_open'] = renderStartHeading
}
