/*
* citation.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/


import type MarkdownIt from "markdown-it/lib"

export const citationPlugin = (md: MarkdownIt) => {

  const kCiteRegex = /^@[\w\-]+/;

  // Very simple plugin example that surrounds @text with `code`
  md.core.ruler.push('quarto-citation', function replaceAtSymbol(state) {
    const tokens = state.tokens;

    for (const token of tokens) {
      if (token.type === 'inline' && token.children) {
        for (let i = 0; i < token.children.length; i++) {
          const child = token.children[i];
          if (child.type === 'text' && child.content.match(kCiteRegex)) {
            const newToken = new state.Token('code_inline', '', 0);
              newToken.content = child.content;
              token.children[i] = newToken;
          }
        }
      }
    }
  });

}
