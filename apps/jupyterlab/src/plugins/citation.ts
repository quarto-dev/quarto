/*
* citation.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/


import type MarkdownIt from "markdown-it/lib"
import Token from "markdown-it/lib/token";

export const citationPlugin = (md: MarkdownIt) => {

  // Very simple plugin example that surrounds @text with `code`
  md.core.ruler.push('quarto-citation', function replaceAtSymbol(state) {
    const tokens = state.tokens;

    for (const token of tokens) {
      if (token.type === 'inline' && token.children) {

        // Rebuild the child list
        const children: Token[] = [];
        for (let i = 0; i < token.children.length; i++) {
          const child = token.children[i];
          if (child.type === 'text') {
            let content = child.content;

            let text: string[] = [];
            const flushText = () => {
              if (text.length) {
                const newToken = new state.Token('text', '', 0);
                newToken.content = text.join("");
                children.push(newToken);
                text = [];                  
              }
            }

            let cite: string[] = [];
            const flushCite = () => {
              if (cite.length) {
                // TODO: replace with a custom token and custom renderer (consider)
                // including cite id and style as attributes to enable
                // previewing in the future.
                const newToken = new state.Token('code_inline', '', 0);
                newToken.content = cite.join("");
                children.push(newToken);
                cite = [];  
              }
            }

            let capture: "text" | "cite" = "text";
            for (let j = 0; j < content.length; j++) {

              const char = content.charAt(j);
              if (char === "@") {
                if (text.length === 1 && text[0] === '-') {
                  cite.push('-');
                  cite.push(char);
                  text = [];
                  capture = 'cite';
                } else if (text[text.length - 1] === ' ') {
                  flushText();   
                  cite.push(char);
                  capture = 'cite';               
                } else if (text[text.length- 1] === '-' && text[text.length - 2] === ' ') {
                  text = text.slice(0, -1);
                  flushText();
                  cite.push('-');
                  cite.push(char);
                  capture = 'cite';
                } else if (text[text.length - 1] === '[' && text[text.length - 2] === ' ') {
                  flushText();
                  cite.push(char);
                  capture = 'cite';
                } else {
                  if (capture === 'cite') {
                    cite.push(char);
                  } else {
                    text.push(char);
                  }  
                }
              } else if (char === " ") { 
                capture = 'text';
                flushCite();
                text.push(char);
              } else if (char === "]") {
                capture = 'text';
                flushCite();
                text.push(char);
              }
              else {
                if (capture === 'cite') {
                  cite.push(char);
                } else {
                  text.push(char);
                }
              }
            }
            flushCite();
            flushText();
          } else {
            children.push(child);
          }
        }
        token.children = children.length > 0 ? children : null;
      }
    }
  });

}
