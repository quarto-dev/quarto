/*
* callout.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/


import type MarkdownIt from "markdown-it/lib"
import Token from "markdown-it/lib/token"

interface PandocDiv {
  id: string
  classes: string[]
  // keywords: string[];
}

export const calloutPlugin = (md: MarkdownIt) => {

  
  // Parse pandoc-style div attributes
  function parseAttrs(attrs: string): PandocDiv {
    const idMatch = attrs.match(/#([\w-]+)/)
    const classMatch = attrs.match(/\.[\w-]+/g)
    // TODO: parse other attributes
    // const keywordMatch = attrs.match(/[\w-]+(?=\=)/g)

    return {
      id: idMatch ? idMatch[1] : "",
      classes: classMatch ? classMatch.map(c => c.slice(1)) : []
      // keywords: keywordMatch ? keywordMatch : [],
    }
  }

  // Render pandoc-style divs
  function renderDiv(tokens: Token[], idx: number): string {
    const token = tokens[idx]

    if (token.nesting === 1) {
      const pandocDiv: PandocDiv = token.meta
      let attrs = ""
      if (pandocDiv.id) {
        attrs += ` id="${pandocDiv.id}"`
      }

      if (pandocDiv.classes.length) {
        attrs += ` class="${pandocDiv.classes.join(" ")}"`
      }

      /*
      pandocDiv.keywords.forEach((keyword, i) => {
        attrs += ` data-${keyword}="${token.meta[i]}"`;
      });
      */

      return `<div${attrs}>\n`
    } else {
      return "</div>\n"
    }
  }

  // Handle pandoc-style divs
  md.block.ruler.before(
    "fence",
    "pandocDiv",
    (state, startLine, endLine, silent) => {
      if (silent) {
        return true
      }

      const pos = state.bMarks[startLine] + state.tShift[startLine]
      const max = state.eMarks[startLine]

      // Check for fence div syntax
      if (
        pos + 3 > max ||
        state.src[pos] !== ":" ||
        state.src[pos + 1] !== ":" ||
        state.src[pos + 2] !== ":"
      ) {
        return false
      }

      const line = state.src.slice(pos, max)
      const startRegex = /^:::\{([\s\S]+?)\}$/
      const match = startRegex.exec(line)

      // Check for valid syntax
      if (!match && line !== ":::") {
        return false
      } else {
        const attrs = match ? parseAttrs(match[1]) : undefined
        if (attrs) {
          // Create opening and closing tokens
          const token = state.push("pandoc_div_open", "div", 1)
          token.meta = attrs
          token.markup = ":::"
          token.map = [startLine, startLine + 1]
        } else {
          const tokenClose = state.push("pandoc_div_close", "div", -1)
          tokenClose.markup = ":::"
        }
      }

      state.line = startLine + 1
      return true
    },
    { alt: [] }
  )

  md.renderer.rules.pandoc_div_open = renderDiv
  md.renderer.rules.pandoc_div_close = renderDiv
}
