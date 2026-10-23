/*
 * paste.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

// unit tests for the editor's generic paste handlers

import { test, suite, after } from "node:test";
import assert from "node:assert/strict";

import { Schema, Slice } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import pasteExtension from "../src/behaviors/paste";
import { ExtensionContext } from "../src/api/extension";

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

// use a real, registered DOI rather than the canonical example DOI
// (10.1000/182, the DOI Handbook): the handbook's registration agency
// doesn't support CSL content negotiation, so pasting that example into
// a live editor fails to look up citation metadata
const kDOI = "10.1038/nature12373";

// doc with a cite_id marked citation in the first paragraph and
// plain text in the second
const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [schema.text(`@${kDOI}`, [schema.marks.cite_id.create()])]),
  schema.node("paragraph", null, [schema.text("some plain text")]),
]);
const kInsideCiteIdPos = 5;
const kOutsideCiteIdPos = doc.child(0).nodeSize + 5; // inside the second paragraph

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

const kDOIText = `https://doi.org/${kDOI}`;
const kDOIHtml = `<a href="${kDOIText}">${kDOIText}</a>`;
const kWordHtml = '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><p>content</p></body></html>';

suite("Editor Paste Handlers", function () {
  after(function () {
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
    assert.equal(pasteHandler()(editorView(kInsideCiteIdPos), event), false);
  });

  test("pass on pastes inside a citation id (text/plain)", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText });
    assert.equal(pasteHandler()(editorView(kInsideCiteIdPos), event), false);
  });

  test("pass on pastes inside a citation id (office content)", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": "content", "text/html": kWordHtml });
    assert.equal(pasteHandler()(editorView(kInsideCiteIdPos), event), false);
  });

  test("handle text/html pastes outside of citation ids on windows", function () {
    setUserAgent(kWindowsUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText, "text/html": kDOIHtml });
    assert.equal(pasteHandler()(editorView(kOutsideCiteIdPos), event), true);
  });

  test("do not handle text/html pastes outside of citation ids on other platforms", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText, "text/html": kDOIHtml });
    assert.equal(pasteHandler()(editorView(kOutsideCiteIdPos), event), false);
  });

  test("handle office content pastes outside of citation ids", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": "content", "text/html": kWordHtml });
    assert.equal(pasteHandler()(editorView(kOutsideCiteIdPos), event), true);
  });

  test("handle text/plain pastes outside of citation ids as markdown", function () {
    setUserAgent(kMacUserAgent);
    const event = clipboardEvent({ "text/plain": kDOIText });
    assert.equal(pasteHandler()(editorView(kOutsideCiteIdPos), event), true);
  });
});
