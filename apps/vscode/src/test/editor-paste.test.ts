/*
 * editor-paste.test.ts
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

// unit tests for the editor's generic paste handlers. these live in the
// vscode extension test suite because it is the only test harness that
// runs in CI; the tests exercise the editor package directly and do not
// use the vscode API.

import * as assert from "assert";

import { Schema, Slice } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import pasteExtension from "editor/src/behaviors/paste";
import { ExtensionContext } from "editor/src/api/extension";

const kWindowsUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const kMacUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// just enough schema to place a selection inside (or outside) a cite_id mark
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
  marks: {
    cite_id: {},
  },
});

// doc with a cite_id marked citation in the first paragraph and
// plain text in the second
const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [schema.text("@10.1000/182", [schema.marks.cite_id.create()])]),
  schema.node("paragraph", null, [schema.text("some plain text")]),
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
      getData: (type: string) => data[type] || "",
    },
  } as unknown as ClipboardEvent;
}

// the handlers detect the platform via navigator.userAgent (which may not
// exist at all in the extension host, depending on the node version)
const kNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
function setUserAgent(userAgent: string) {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent },
    configurable: true,
  });
}

const kDOIText = "https://doi.org/10.1000/182";
const kDOIHtml = '<a href="https://doi.org/10.1000/182">https://doi.org/10.1000/182</a>';
const kWordHtml = '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><p>content</p></body></html>';

suite("Editor Paste Handlers", function () {
  suiteTeardown(function () {
    if (kNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", kNavigatorDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
  });

  test("pass on pastes inside a citation id (text/html on windows)", function () {
    // a DOI copied from a browser carries text/html, which the windows
    // paste handler would otherwise consume before the cite mark's paste
    // handler could offer to insert a citation from the DOI
    // (https://github.com/rstudio/rstudio/issues/18295)
    setUserAgent(kWindowsUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText, "text/html": kDOIHtml });
    assert.strictEqual(pasteHandler()(editorView(kInsideCiteIdPos), event), false);
  });

  test("pass on pastes inside a citation id (text/plain)", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText });
    assert.strictEqual(pasteHandler()(editorView(kInsideCiteIdPos), event), false);
  });

  test("pass on pastes inside a citation id (office content)", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": "content", "text/html": kWordHtml });
    assert.strictEqual(pasteHandler()(editorView(kInsideCiteIdPos), event), false);
  });

  test("handle text/html pastes outside of citation ids on windows", function () {
    setUserAgent(kWindowsUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText, "text/html": kDOIHtml });
    assert.strictEqual(pasteHandler()(editorView(kOutsideCiteIdPos), event), true);
  });

  test("do not handle text/html pastes outside of citation ids on other platforms", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText, "text/html": kDOIHtml });
    assert.strictEqual(pasteHandler()(editorView(kOutsideCiteIdPos), event), false);
  });

  test("handle office content pastes outside of citation ids", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": "content", "text/html": kWordHtml });
    assert.strictEqual(pasteHandler()(editorView(kOutsideCiteIdPos), event), true);
  });

  test("handle text/plain pastes outside of citation ids as markdown", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText });
    assert.strictEqual(pasteHandler()(editorView(kOutsideCiteIdPos), event), true);
  });
});
