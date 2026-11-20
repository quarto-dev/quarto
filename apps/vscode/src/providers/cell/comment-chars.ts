/*
 * comment-chars.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

// comment characters used for cell options by language (e.g. #| for
// python/r, //| for js, --| for sql). pairs are block comment delimiters
// (/*| ... */).
//
// note: this module must remain dependency-free: it is also imported by
// syntaxes/build-lang.mjs to generate the cell option comment rules of the
// quarto textmate grammar

export const kLangCommentChars: Record<string, string | [string, string]> = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  c: ["/*", "*/"],
  css: ["/*", "*/"],
  sas: ["*", ";"],
  powershell: "#",
  bash: "#",
  sql: "--",
  ggsql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  mermaid: "%%",
  ojs: "//",
  apl: "⍝",
};

export function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}

// other comment characters that also start a language's cell option lines.
// ggsql's options are written `--|`, as for sql, since `#` is not a comment in
// ggsql. But quarto-cli does not know ggsql yet and reads `#|` options, which
// the ggsql docs use, so those are honored too until quarto-cli decides
export const kLangAltOptionCommentChars: Record<string, string[]> = {
  ggsql: ["#"],
};

export function optionCommentPattern(comment: string) {
  return new RegExp("^" + escapeRegExp(comment) + "\\s*\\| ?");
}

// the pattern for the cell option lines of `lang`: its own comment characters
// (the opening ones, for block comments), or any alternative ones in
// kLangAltOptionCommentChars
export function langOptionCommentPattern(lang: string) {
  const comments = [langCommentChars(lang)[0], ...(kLangAltOptionCommentChars[lang] ?? [])];
  if (comments.length === 1) {
    return optionCommentPattern(comments[0]);
  }
  return new RegExp("^(?:" + comments.map(escapeRegExp).join("|") + ")\\s*\\| ?");
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
