/*
* fence.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import type MarkdownIt from "markdown-it/lib"
import Token from "markdown-it/lib/token"
import Renderer from "markdown-it/lib/renderer";
import { attributeDecorator, decorator } from "../utils/html";
import { kTokDivOpen } from "./divs";


const kTokDecorator = "quarto_decorator";

export const decoratorPlugin = (md: MarkdownIt) => {

  md.core.ruler.push('quarto-decorator', function replaceAtSymbol(state) {
    const outTokens: Token[] = [];
    for (const token of state.tokens) {
      if (token.type === "fence" && !token.attrs && token.info) {
        outTokens.push(decoratorTokForToken(token));
      } else if (token.type === "heading_open" && token.attrs) {
        outTokens.push(decoratorTokForToken(token));
      } else if (token.type === kTokDivOpen && token.attrs) {
        outTokens.push(decoratorTokForToken(token));
      }
      outTokens.push(token);
    } 
    state.tokens = outTokens;
  });
  
  md.renderer.rules[kTokDecorator] = renderDecorator
}

function decoratorTokForToken(token: Token) {
  const decoratorTok = new Token(kTokDecorator, "div", 1);
  decoratorTok.attrs = token.attrs;
  decoratorTok.info = token.info;
  return decoratorTok;
}

// Render pandoc-style divs
function renderDecorator(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, self: Renderer): string {
  const token = tokens[idx];
  if (token.info) {
    return decorator([token.info]) ;
  } else {
    return attributeDecorator(token);
  }
}

