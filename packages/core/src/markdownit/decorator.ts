/*
* fence.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import type { MarkdownIt, Token } from "markdown-it";
import { attributeDecorator, decorator, DecoratorOptions } from "./utils/html";
import { kTokDivOpen } from "./divs";
import { kTokFigureOpen } from "./figures";
import { kTokHeadingOpen, kTokTableOpen } from "./utils/tok";
import { kTokMathBlock } from "./math";


const kTokDecorator = "quarto_decorator";
const kQuartoDecoratorOptions = "quarto-decorator-options";


export const decoratorPlugin = (md: MarkdownIt) => {

  md.core.ruler.push('quarto-decorator', function replaceAtSymbol(state) {
    const outTokens: Token[] = [];
    for (const token of state.tokens) {
      if (token.type === "fence" && !token.attrs && token.info) {
        outTokens.push(decoratorTokForToken(state.Token, token));
      } else if (token.type === kTokHeadingOpen && token.attrs) {
        outTokens.push(decoratorTokForToken(state.Token, token));
      } else if (token.type === kTokDivOpen && token.attrs) {
        outTokens.push(decoratorTokForToken(state.Token, token));
      } else if (token.type === kTokFigureOpen && token.attrs) {
        outTokens.push(decoratorTokForToken(state.Token, token, { hide: { attributes: true }}));
      } else if (token.type === kTokTableOpen && token.attrs) {
        outTokens.push(decoratorTokForToken(state.Token, token));
      } else if (token.type === kTokMathBlock && token.attrs) {
        outTokens.push(decoratorTokForToken(state.Token, token));
      }
      outTokens.push(token);
    } 
    state.tokens = outTokens;
  });
  
  md.renderer.rules[kTokDecorator] = renderDecorator
}

// Use the parser's Token class (state.Token) rather than importing one: in the
// notebook renderer this plugin runs on the host's markdown-it instance.
function decoratorTokForToken(TokenCtor: typeof Token, token: Token, options?: DecoratorOptions) {
  const decoratorTok = new TokenCtor(kTokDecorator, "div", 1);
  decoratorTok.attrs = token.attrs;
  decoratorTok.info = token.info;
  if (options) {
    decoratorTok.meta = decoratorTok.meta || {};
    decoratorTok.meta[kQuartoDecoratorOptions] = options;  
  }
  return decoratorTok;
}


// Render pandoc-style divs
function renderDecorator(tokens: Token[], idx: number): string {
  const token = tokens[idx];
  const decoratorOptions = token.meta?.[kQuartoDecoratorOptions] as DecoratorOptions | undefined;
  if (token.info) {
    return decorator([token.info]) ;
  } else {
    return attributeDecorator(token, decoratorOptions);
  }
}

