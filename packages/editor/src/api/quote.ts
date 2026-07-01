/*
 * quote.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export const kQuoteType = 0;
export const kQuoteChildren = 1;

export enum QuoteType {
  SingleQuote = 'SingleQuote',
  DoubleQuote = 'DoubleQuote',
}

export function quotesForType(type: QuoteType) {
  const dblQuote = type === QuoteType.DoubleQuote;
  return {
    begin: dblQuote ? '“' : '‘',
    end: dblQuote ? '”' : '’',
  };
}

// create regexs for removing quotes
const kSingleQuotes = quotesForType(QuoteType.SingleQuote);
const kSingleQuoteRegEx = new RegExp(`[${kSingleQuotes.begin}${kSingleQuotes.end}]`, 'g');
const kDoubleQuotes = quotesForType(QuoteType.DoubleQuote);
const kDoubleQuoteRegEx = new RegExp(`[${kDoubleQuotes.begin}${kDoubleQuotes.end}]`, 'g');

export function fancyQuotesToSimple(text: string) {
  return text.replace(kSingleQuoteRegEx, "'").replace(kDoubleQuoteRegEx, '"');
}
