/*
 * paste.test.ts
 *
 * Copyright (C) 2025 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { describe, expect, it } from 'vitest';

import { Schema, Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import pasteExtension from '../../src/behaviors/paste';
import { ExtensionContext } from '../../src/api/extension';

const kWindowsUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const kMacUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// just enough schema to place a selection inside (or outside) a cite_id mark
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
  },
  marks: {
    cite_id: {},
  },
});

// doc with a cite_id marked citation in the first paragraph and
// plain text in the second
const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('@10.1000/182', [schema.marks.cite_id.create()])]),
  schema.node('paragraph', null, [schema.text('some plain text')]),
]);
const kInsideCiteIdPos = 5;
const kOutsideCiteIdPos = 18;

function editorView(pos: number): EditorView {
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, pos),
  });
  return { state, dispatch: () => undefined } as unknown as EditorView;
}

function pasteHandler() {
  const context = {
    markdown: {
      allowMarkdownPaste: () => true,
      markdownToSlice: () => new Promise<Slice>(() => undefined),
    },
  } as unknown as ExtensionContext;
  const extension = pasteExtension(context);
  const plugin = extension.plugins(schema)[0];
  const handlePaste = plugin.props.handlePaste!;
  return (view: EditorView, event: ClipboardEvent) => {
    return handlePaste.call(plugin, view, event, Slice.empty) as boolean;
  };
}

function clipboardEvent(data: Record<string, string>): ClipboardEvent {
  return {
    clipboardData: {
      types: Object.keys(data),
      getData: (type: string) => data[type] || '',
    },
  } as unknown as ClipboardEvent;
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

const kDOIText = 'https://doi.org/10.1000/182';
const kDOIHtml = '<a href="https://doi.org/10.1000/182">https://doi.org/10.1000/182</a>';
const kWordHtml = '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><p>content</p></body></html>';

describe('paste handlers', () => {
  it('pass on pastes inside a citation id (text/html on windows)', () => {
    // a DOI copied from a browser carries text/html, which the windows
    // paste handler would otherwise consume before the cite mark's paste
    // handler could offer to insert a citation from the DOI
    // (https://github.com/rstudio/rstudio/issues/18295)
    setUserAgent(kWindowsUserAgent);
    const event = clipboardEvent({ 'text/plain': kDOIText, 'text/html': kDOIHtml });
    expect(pasteHandler()(editorView(kInsideCiteIdPos), event)).toBe(false);
  });

  it('pass on pastes inside a citation id (text/plain)', () => {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ 'text/plain': kDOIText });
    expect(pasteHandler()(editorView(kInsideCiteIdPos), event)).toBe(false);
  });

  it('pass on pastes inside a citation id (office content)', () => {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ 'text/plain': 'content', 'text/html': kWordHtml });
    expect(pasteHandler()(editorView(kInsideCiteIdPos), event)).toBe(false);
  });

  it('handle text/html pastes outside of citation ids on windows', () => {
    setUserAgent(kWindowsUserAgent);
    const event = clipboardEvent({ 'text/plain': kDOIText, 'text/html': kDOIHtml });
    expect(pasteHandler()(editorView(kOutsideCiteIdPos), event)).toBe(true);
  });

  it('do not handle text/html pastes outside of citation ids on other platforms', () => {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ 'text/plain': kDOIText, 'text/html': kDOIHtml });
    expect(pasteHandler()(editorView(kOutsideCiteIdPos), event)).toBe(false);
  });

  it('handle office content pastes outside of citation ids', () => {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ 'text/plain': 'content', 'text/html': kWordHtml });
    expect(pasteHandler()(editorView(kOutsideCiteIdPos), event)).toBe(true);
  });

  it('handle text/plain pastes outside of citation ids as markdown', () => {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ 'text/plain': kDOIText });
    expect(pasteHandler()(editorView(kOutsideCiteIdPos), event)).toBe(true);
  });
});
