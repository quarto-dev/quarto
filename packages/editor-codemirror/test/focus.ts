/// <reference types="vite/client" />

/*
 * Browser regression tests: run `node node_modules/vite/bin/vite.js
 * packages/editor-codemirror/test` from the repository root, then open /focus.html.
 * Real DOM selection and focus behavior are required (not jsdom).
 */
import { Schema } from "prosemirror-model";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { DecorationSet, EditorView } from "prosemirror-view";
import { EditorView as CodeMirrorView } from "@codemirror/view";
import { DispatchEvent, ExtensionContext } from "editor";
import { DOMEditorEvents } from "editor/src/api/events";
import { Editor } from "editor/src/editor/editor";
import { ExtensionManager } from "editor/src/editor/editor-extensions";
import { codeMirrorExtension } from "../src/index";

const schema = new Schema({ nodes: {
  doc: { content: "block+" },
  text: { group: "inline" },
  paragraph: { group: "block", content: "text*", toDOM: () => ["p", 0] },
  code_block: { group: "block", content: "text*", code: true, toDOM: () => ["pre", 0] },
  blockquote: { group: "block", content: "block+", toDOM: () => ["blockquote", 0] },
} });

function fixture(nested = false, empty = false) {
  const host = document.body.appendChild(document.createElement("div"));
  const outside = host.appendChild(document.createElement("button"));
  outside.textContent = "Outside editor";
  const events = new DOMEditorEvents(host);
  // Only services used by a plain code block are needed; no server is involved.
  const context = {
    events,
    ui: {
      context: { getDocumentPath: () => null, translateText: (text: string) => text },
      prefs: new Proxy({}, { get: (_, key) => () => key === "tabWidth" ? 2 : false }),
    },
    theme: () => ({ darkMode: false, fixedWidthFontSizePt: 12 }),
    find: { decorations: () => DecorationSet.empty },
    options: {}, format: {},
  } as unknown as ExtensionContext;
  const extensions = new ExtensionManager(context);
  extensions.register([codeMirrorExtension({ code_block: { lang: () => null } })]);
  const chunk = schema.node("code_block", null, empty ? [] : schema.text("alpha bravo\ncharlie delta"));
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, schema.text("prose before")),
    nested ? schema.node("blockquote", null, chunk) : chunk,
    schema.node("paragraph", null, schema.text("prose after")),
  ]);
  const view = new EditorView(host.appendChild(document.createElement("div")), {
    state: EditorState.create({ schema, doc, plugins: extensions.plugins(schema) }),
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      events.emit(DispatchEvent, tr);
    },
  });
  const cm = CodeMirrorView.findFromDOM(host.querySelector(".cm-content") as HTMLElement)!;
  let outerFocus = 0;
  view.dom.addEventListener("focus", () => outerFocus++);
  // Exercise the actual public focus implementation without initializing Pandoc.
  const focus = () => Editor.prototype.focus.call({ view, extensions } as unknown as Editor);
  return { view, cm, outside, focus, extensions, start: nested ? 16 : 15,
    outerFocus: () => outerFocus,
    destroy: () => { view.destroy(); host.remove(); },
  };
}

function assert(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
const results: string[] = [];

async function run() {
  for (const [name, anchor, head, nested, empty] of [
    ["middle", 7, 7, false, false],
    ["start", 0, 0, false, false],
    ["end", 24, 24, false, false],
    ["forward selection", 3, 10, false, false],
    ["backward selection", 10, 3, false, false],
    ["nested chunk", 7, 7, true, false],
    ["empty chunk", 0, 0, false, true],
  ] as const) {
    const f = fixture(nested, empty);
    try {
      f.outside.focus();
      f.view.dispatch(f.view.state.tr.setSelection(TextSelection.create(
        f.view.state.doc, f.start + anchor, f.start + head)));
      f.focus();
      await settle();
      f.outside.focus();
      f.focus();
      await settle();
      assert(f.cm.hasFocus, `${name}: code editor did not regain focus`);
      assert(f.cm.state.selection.main.anchor === anchor && f.cm.state.selection.main.head === head,
        `${name}: selection changed`);
      assert(f.outerFocus() === 0, `${name}: outer editor received focus during restoration`);
      results.push(`PASS ${name}`);
    } finally { f.destroy(); }
  }
  for (const name of ["prose", "cross-block selection", "node selection", "whole document"]) {
    const f = fixture();
    try {
      const doc = f.view.state.doc;
      const selection = name === "prose" ? TextSelection.create(doc, 3) :
        name === "cross-block selection" ? TextSelection.create(doc, 3, f.start + 7) :
        name === "node selection" ? NodeSelection.create(doc, f.start - 1) : new AllSelection(doc);
      if (name === "prose") {
        f.view.dispatch(f.view.state.tr.setSelection(selection));
        f.focus();
        assert(f.view.hasFocus(), "prose: editor did not regain focus");
      } else {
        // Verify routing without invoking unrelated cross-block/node selection behavior.
        let fallback = false;
        const view = {
          state: EditorState.create({ schema, doc, selection }),
          focus: () => { fallback = true; },
        } as unknown as EditorView;
        Editor.prototype.focus.call({ view, extensions: f.extensions } as unknown as Editor);
        assert(fallback, `${name}: existing focus path was bypassed`);
      }
      results.push(`PASS ${name} fallback`);
    } finally { f.destroy(); }
  }
  document.querySelector("#results")!.textContent = results.join("\n");
  document.documentElement.dataset.result = "passed";
}
run().catch(error => {
  document.querySelector("#results")!.textContent = [...results, `FAIL ${error.stack}`].join("\n");
  document.documentElement.dataset.result = "failed";
});
