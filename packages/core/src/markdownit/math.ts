/*
 * math.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 *
 */

// From https://github.com/tani/markdown-it-mathjax3
/* Process inline math */
/*
Like markdown-it-simplemath, this is a stripped down, simplified version of:
https://github.com/runarberg/markdown-it-math

It differs in that it takes (a subset of) LaTeX as input and relies on MathJax
for rendering output.
*/
import type MarkdownIt from "markdown-it";

import type Token from "markdown-it/lib/token";
import type StateInline from "markdown-it/lib/rules_inline/state_inline";
import type StateBlock from "markdown-it/lib/rules_block/state_block";

export const kTokMathBlock = "math_block";
export const kTokMathInline = "math_inline";

// A closing `$$` may be followed by a pandoc attribute block, e.g. `$$ {#eq-label}`.
// Both close checks below share this tail so they cannot drift apart again: the
// single-line check once omitted it, which made a labeled one-line equation
// consume the rest of the document (https://github.com/quarto-dev/quarto/issues/976).
const kAttrTail = String.raw`\s*(\{.*\})?\s*$`;

// Close on the same line as the opening `$$`, e.g. `$$1+1$$ {#eq-label}`
const kCloseSameLine = new RegExp(String.raw`^(.*)\$\$` + kAttrTail);

// Close on a line of its own, e.g. `$$ {#eq-label}`
const kCloseOwnLine = new RegExp(String.raw`^\$\$` + kAttrTail);


interface ConvertOptions {
  display: boolean
}

function renderMath(content: string, convertOptions: ConvertOptions): string {
  if (convertOptions.display) {
    return `<div class='quarto-display-math'>\\[${content}\\]</div>`;
  } else {
    return `<span class='quarto-inline-math'>\\(${content}\\)</span>`;
  }
}

// Test if potential opening or closing delimieter
// Assumes that there is a "$" at state.src[pos]
function isValidDelim(state: StateInline, pos: number) {
  const max = state.posMax;
  let can_open = true;
  let can_close = true;

  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1,
    nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;

  // Check non-whitespace conditions for opening and closing, and
  // check that closing delimeter isn't followed by a number
  if (
    prevChar === 0x20 /* " " */ ||
    prevChar === 0x09 /* \t */ ||
    (nextChar >= 0x30 /* "0" */ && nextChar <= 0x39) /* "9" */
  ) {
    can_close = false;
  }
  if (nextChar === 0x20 /* " " */ || nextChar === 0x09 /* \t */) {
    can_open = false;
  }

  return {
    can_open: can_open,
    can_close: can_close,
  };
}

function math_inline(state: StateInline, silent: boolean) {
  if (state.src[state.pos] !== "$") {
    return false;
  }

  let res = isValidDelim(state, state.pos);
  if (!res.can_open) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos += 1;
    return true;
  }

  // First check for and bypass all properly escaped delimieters
  // This loop will assume that the first leading backtick can not
  // be the first character in state.src, which is known since
  // we have found an opening delimieter already.
  const start = state.pos + 1;
  let match = start;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    // Found potential $, look for escapes, pos will point to
    // first non escape when complete
    let pos = match - 1;
    while (state.src[pos] === "\\") {
      pos -= 1;
    }

    // Even number of escapes, potential closing delimiter found
    if ((match - pos) % 2 == 1) {
      break;
    }
    match += 1;
  }

  // No closing delimter found.  Consume $ and continue.
  if (match === -1) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  // Check if we have empty content, ie: $$.  Do not parse.
  if (match - start === 0) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start + 1;
    return true;
  }

  // Check for valid closing delimiter
  res = isValidDelim(state, match);
  if (!res.can_close) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
}

function math_block(
  state: StateBlock,
  start: number,
  end: number,
  silent: boolean
) {
  let next: number, lastPos: number;
  let found = false,
    pos = state.bMarks[start] + state.tShift[start],
    max = state.eMarks[start],
    lastLine = "";

  if (pos + 2 > max) {
    return false;
  }
  if (state.src.slice(pos, pos + 2) !== "$$") {
    return false;
  }

  pos += 2;
  let firstLine = state.src.slice(pos, max);

  if (silent) {
    return true;
  }
  let attrStr: string | undefined;
  const singleLineMatch = firstLine.trim().match(kCloseSameLine);
  if (singleLineMatch) {
    // Single line expression, optionally followed by attributes (e.g. {#eq-label})
    firstLine = singleLineMatch[1];
    attrStr = singleLineMatch[2];
    found = true;
  }

  for (next = start; !found; ) {
    next++;

    if (next >= end) {
      break;
    }

    pos = state.bMarks[next] + state.tShift[next];
    max = state.eMarks[next];

    if (pos < max && state.tShift[next] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      break;
    }

    const line = state.src.slice(pos, max).trim();
    const match = line.match(kCloseOwnLine);
    if (match) {
      lastPos = state.src.slice(0, max).lastIndexOf("$$");
      lastLine = state.src.slice(pos, lastPos);
      attrStr = match[1];
      found = true;
    }
  }

  // Without a close, decline the rule rather than emitting a token that runs to
  // the end of the document. Consuming the remainder hides every heading and code
  // cell below from the outline and from cell execution, which is what an
  // in-progress `$$` looks like while it is still being typed.
  if (!found) {
    return false;
  }

  state.line = next + 1;

  const token = state.push(kTokMathBlock, "math", 0);
  token.block = true;
  if (attrStr) {
    token.info = attrStr;
  }
  token.content =
    (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : "");
  token.map = [start, state.line];
  token.markup = "$$";
  return true;
}

export function mathjaxPlugin(md: MarkdownIt, options?: { enableInlines?: boolean }) {
  // Default options
  options = options || {};
  const enableInlines = (options.enableInlines !== undefined) ? options.enableInlines : true; 

  const convertOptions = {
    display: false
  }

  // set MathJax as the renderer for markdown-it-simplemath
  md.inline.ruler.after("escape", kTokMathInline, math_inline);
  md.block.ruler.after("blockquote", kTokMathBlock, math_block, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  if (enableInlines) {
    md.renderer.rules.math_inline = function (tokens: Token[], idx: number) {
      convertOptions.display = false;
      return renderMath(tokens[idx].content, convertOptions)
    };
  }
  md.renderer.rules.math_block = function (tokens: Token[], idx: number) {
    convertOptions.display = true;
    return renderMath(tokens[idx].content, convertOptions)
  };
};