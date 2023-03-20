/*
* callout.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import type MarkdownIt from "markdown-it/lib"
import Token from "markdown-it/lib/token"
import Renderer from "markdown-it/lib/renderer";

export const kTokDivOpen = 'pandoc_div_open';
export const kTokDivClose = 'pandoc_div_close';

const parseAttr = (attr?: string) => {
  // starts with #    id
  // starts with .    class
  // all else are attr
  const attributes: Record<string, string> = {};
  if (attr) {
    const parts = attr.split(' ');
    for (const part of parts) {
      const clz: string[] = [];
      if (part.startsWith('#')) {
        // id attribute 
        if (!!attributes['id']) {
          attributes['id'] = part.substring(1);
        } else {
          throw new Error(`Duplicate id for attribute ${attr}`);
        }
      } else if (part.startsWith('.')) {
        // classes
        clz.push(part.substring(1))
      } else {
        // other attributes
        if (part.includes('=')) {
          const partSplit = part.split('=');
          const name = partSplit[0];
          const value = partSplit.slice(1).join("");
          attributes[name] = value;
        } else {
          attributes[part] = "";
        }
      }

      // classes
      if (clz.length > 0) {
        attributes['class'] = clz.join(" ");
      }
    }  
  }
  return attributes;
}

export const divPlugin = (md: MarkdownIt) => {
  
  // Render pandoc-style divs
  function renderStartDiv(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, self: Renderer): string {
    const token = tokens[idx];
    return `<div ${self.renderAttrs(token)}>`;
  }

  // Render pandoc-style divs
  function renderEndDiv(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, self: Renderer): string {
    return `</div>`;
  }

  // Handle pandoc-style divs
  md.block.ruler.before(
    "fence",
    "pandocDiv",
    (state, start, end, silent) => {

      // This is a validation run, can ignore
      if (silent) {
        return true;
      }

      const pos = state.bMarks[start] + state.tShift[start];
      const max = state.eMarks[start];
      
      // Has to be at least 3 characters
      if (pos + 3 > max) {
        return false;
      }

      // Starts with 3 or more colons
      if (
        state.src[pos] !== ":" ||
        state.src[pos + 1] !== ":" ||
        state.src[pos + 2] !== ":"
      ) {
        return false
      }

      // Get the line for parsing
      const line = state.src.slice(pos, max)

      // Three or more colons followed by a an option brace with attributes
      const divRegex = /^(:::+)(?:\{([\s\S]+?)\})?$/;

      // The current state of the divs (e.g. is there an open)
      // div. Data structure holds key that is the number of colons
      const divState = state.env.quartoOpenDivs || {};

      const incrementDivCount = (fence: string) => {
        state.env.quartoOpenDivs = state.env.quartoOpenDivs || {};
        const current = state.env.quartoOpenDivs[fence] || 0;
        state.env.quartoOpenDivs[fence] = Math.max(0, current + 1);
      }

      const decrementDivCount = (fence: string) => {
        state.env.quartoOpenDivs = state.env.quartoOpenDivs || {};
        const current = state.env.quartoOpenDivs[fence] || 0;
        state.env.quartoOpenDivs[fence] = Math.max(0, current - 1);
      }

      const match = divRegex.exec(line);
      if (match) {
        // There is a div here, is one already open?
        const divFence = match[1];
        const attr = match[2];

        // Is this open?
        let isOpenDiv = false;
        const openCount = divState[divFence];
        if (!openCount || openCount === 0) {
          // There isn't an existing open div at this level (number of colons)
          isOpenDiv = true;
        } else if (attr) {
          // If it has attributes it is always open
          isOpenDiv = true;
        }

        if (isOpenDiv) {
          
          // Add to the open count (or set it to 1)
          incrementDivCount(divFence);

          // Make an open token
          const token = state.push(kTokDivOpen, "div", 1)
          token.markup = line;

          // Parse attributes and push onto token
          const attributes = parseAttr(attr);
          const attrArray: [string, string][] = Object.keys(attributes).map((key) => { return [key, attributes[key]]});
          token.attrs = token.attrs || [];
          token.attrs.push(...attrArray);

        } else {
          // Subtract from the open count (min zero)
          decrementDivCount(divFence);

          // Make a close token
          const token = state.push(kTokDivClose, "div", -1)
          token.markup = line; 
        }
      }

      state.line = start + 1
      return true
    },
    { alt: [] }
  )

  md.renderer.rules[kTokDivOpen] = renderStartDiv
  md.renderer.rules[kTokDivClose] = renderEndDiv
}
