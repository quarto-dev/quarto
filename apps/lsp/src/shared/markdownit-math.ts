/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) 2016 Waylon Flinn
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MarkdownIt from "markdown-it";
import StateInline from "markdown-it/lib/rules_inline/state_inline";
import StateBlock from "markdown-it/lib/rules_block/state_block";

// Fork of https://github.com/mjbvz/markdown-it-katex/ that doesn't render
// (so has no depencency on katex or mathjax)

export function mathPlugin(md: MarkdownIt, options: Record<string, undefined>) {
  options = options || {};
  const enableBareBlocks = !!options.enableBareBlocks;
  const enableInlines = !!options.enableInlines;
  if (enableInlines) {
    md.inline.ruler.after("escape", "math_inline", math_inline);
    md.inline.ruler.after("escape", "math_inline_block", math_inline_block);
  }
  md.block.ruler.after(
    "blockquote",
    "math_block",
    (state, start, end, silent) => {
      if (enableBareBlocks && bare_math_block(state, start, end, silent)) {
        return true;
      }
      return math_block_dollar(state, start, end, silent);
    },
    {
      alt: ["paragraph", "reference", "blockquote", "list"],
    }
  );
}

function isValidInlineDelim(state: StateInline, pos: number) {
  const prevChar = state.src[pos - 1];
  const char = state.src[pos];
  const nextChar = state.src[pos + 1];

  if (char !== "$") {
    return { can_open: false, can_close: false };
  }

  let canOpen = false;
  let canClose = false;
  if (
    prevChar !== "$" &&
    prevChar !== "\\" &&
    (prevChar === undefined ||
      isWhitespace(prevChar) ||
      !isWordCharacterOrNumber(prevChar))
  ) {
    canOpen = true;
  }

  if (
    nextChar !== "$" &&
    (nextChar == undefined ||
      isWhitespace(nextChar) ||
      !isWordCharacterOrNumber(nextChar))
  ) {
    canClose = true;
  }

  return { can_open: canOpen, can_close: canClose };
}

/**
 * @param {string} char
 * @returns {boolean}
 */
function isWhitespace(char: string) {
  return /^\s$/u.test(char);
}

/**
 * @param {string} char
 * @returns {boolean}
 */
function isWordCharacterOrNumber(char: string) {
  return /^[\w\d]$/u.test(char);
}

/**
 * @returns {{ can_open: boolean, can_close: boolean }}
 */
function isValidBlockDelim(state: StateInline, pos: number) {
  const prevChar = state.src[pos - 1];
  const char = state.src[pos];
  const nextChar = state.src[pos + 1];
  const nextCharPlus1 = state.src[pos + 2];

  if (
    char === "$" &&
    prevChar !== "$" &&
    prevChar !== "\\" &&
    nextChar === "$" &&
    nextCharPlus1 !== "$"
  ) {
    return { can_open: true, can_close: true };
  }

  return { can_open: false, can_close: false };
}

function math_inline(state: StateInline, silent: boolean) {
  var start, match, token, res, pos;

  if (state.src[state.pos] !== "$") {
    return false;
  }

  res = isValidInlineDelim(state, state.pos);
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
  start = state.pos + 1;
  match = start;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    // Found potential $, look for escapes, pos will point to
    // first non escape when complete
    pos = match - 1;
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
  res = isValidInlineDelim(state, match);
  if (!res.can_close) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
}

function math_block_dollar(
  state: StateBlock,
  start: number,
  end: number,
  silent: boolean
) {
  var lastLine,
    next,
    lastPos,
    found = false,
    token,
    pos = state.bMarks[start] + state.tShift[start],
    max = state.eMarks[start];

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
  if (firstLine.trim().slice(-2) === "$$") {
    // Single line expression
    firstLine = firstLine.trim().slice(0, -2);
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

    if (state.src.slice(pos, max).trim().slice(0, 2) === "$$") {
      lastPos = state.src.slice(0, max).lastIndexOf("$$");
      lastLine = state.src.slice(pos, lastPos);
      found = true;
    }
  }

  state.line = next + 1;

  token = state.push("math_block", "math", 0);
  token.block = true;
  token.content =
    (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : "");
  token.map = [start, state.line];
  token.markup = "$$";
  return true;
}

function bare_math_block(
  state: StateBlock,
  start: number,
  end: number,
  silent: boolean
) {
  var lastLine,
    found = false,
    pos = state.bMarks[start] + state.tShift[start],
    max = state.eMarks[start];

  const firstLine = state.src.slice(pos, max);

  const beginRe = /^\\begin/;
  const endRe = /^\\end/;

  if (!beginRe.test(firstLine)) {
    return false;
  }

  if (silent) {
    return true;
  }

  let nestingCount = 0;
  let next;
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
    const line = state.src.slice(pos, max);
    if (beginRe.test(line)) {
      ++nestingCount;
    } else if (endRe.test(line)) {
      --nestingCount;
      if (nestingCount < 0) {
        const lastPos = max;
        lastLine = state.src.slice(pos, lastPos);
        found = true;
      }
    }
  }

  state.line = next + 1;

  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content =
    (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : "");
  token.map = [start, state.line];
  token.markup = "$$";
  return true;
}

function math_inline_block(state: StateInline, silent: boolean) {
  var start, match, token, res, pos;

  if (state.src.slice(state.pos, state.pos + 2) !== "$$") {
    return false;
  }

  res = isValidBlockDelim(state, state.pos);
  if (!res.can_open) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos += 2;
    return true;
  }

  // First check for and bypass all properly escaped delimieters
  // This loop will assume that the first leading backtick can not
  // be the first character in state.src, which is known since
  // we have found an opening delimieter already.
  start = state.pos + 2;
  match = start;
  while ((match = state.src.indexOf("$$", match)) !== -1) {
    // Found potential $$, look for escapes, pos will point to
    // first non escape when complete
    pos = match - 1;
    while (state.src[pos] === "\\") {
      pos -= 1;
    }

    // Even number of escapes, potential closing delimiter found
    if ((match - pos) % 2 == 1) {
      break;
    }
    match += 2;
  }

  // No closing delimter found.  Consume $$ and continue.
  if (match === -1) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start;
    return true;
  }

  // Check if we have empty content, ie: $$$$.  Do not parse.
  if (match - start === 0) {
    if (!silent) {
      state.pending += "$$$$";
    }
    state.pos = start + 2;
    return true;
  }

  // Check for valid closing delimiter
  res = isValidBlockDelim(state, match);
  if (!res.can_close) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    token = state.push("math_block", "math", 0);
    token.block = true;
    token.markup = "$$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 2;
  return true;
}
