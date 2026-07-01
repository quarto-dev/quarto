/*
 * cite-doi.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorState, Transaction } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';

import { findDOI } from '../../api/doi';

import { parseCitation, ParsedCitation } from './cite';

// Parses the transation or state to determine whether the current position
// represents a citation containing a DOI
export function doiFromEditingContext(context: EditorState | Transaction): ParsedCitation | undefined {
  
  const parsedCitation = parseCitation(context);
  if (parsedCitation) {
    const doi = findDOI(parsedCitation.token);
    if (doi) {
      return parsedCitation;
    }
    return undefined;
  } else {
    return undefined
  }
}

// Parses a slice to determine whether the slice contains
// a single DOI
export function doiFromSlice(context: EditorState | Transaction, slice: Slice): ParsedCitation | undefined {
  const parsedCitation = parseCitation(context);
  if (parsedCitation) {
    // Concatenate all the text and search for a DOI
    let text = '';
    slice.content.forEach(node => (text = text + node.textContent));
    if (text.length) {
      const doi = findDOI(text.trim());
      if (doi) {
        return { ...parsedCitation, token: doi };
      }
    }
    return undefined;
  } else {
    return undefined;
  }
}
