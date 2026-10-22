/*
 * formatting.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export interface FormattingTag {
  open: string;
  close: string;
  verbatim: boolean;
}

// Maps formatting tags/marks to the LaTeX replacements
// When marks are applied to text nodes, these will be emitted in place of those marks
export const FormattingTags: { [key: string]: FormattingTag } = {
  strong: { open: '\\textbf{', close: '}', verbatim: false },
  em: { open: '\\emph{', close: '}', verbatim: false },
  sub: { open: '\\textsubscript{', close: '}', verbatim: false },
  sup: { open: '\\textsuperscript{', close: '}', verbatim: false },
  nocase: { open: '{{', close: '}}', verbatim: false },
  smallcaps: { open: '\\textsc{', close: '}', verbatim: false },
  enquote: { open: '\\enquote{', close: '}', verbatim: false },
  math: { open: '$', close: '$', verbatim: false },
  url: { open: '\\url{', close: '}', verbatim: true },
};
