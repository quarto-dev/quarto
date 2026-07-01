/*
 * cite-highlight.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { PluginKey } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';

import { markHighlightPlugin, markHighlightDecorations } from '../../api/mark-highlight';

const key = new PluginKey<DecorationSet>('cite-highlight');

export function citeHighlightPlugin(schema: Schema) {
  return markHighlightPlugin(key, schema.marks.cite, (text, _attrs, markRange) => {
    return markHighlightDecorations(markRange, text, /([[\]])/g, 'pm-link-text-color pm-fixedwidth-font');
  });
}
