/*
 * previewCommandBridge.test.ts
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vm from "node:vm";
import { createPreviewCommandBridge, isPreviewCommandMessage } from "../providers/preview/command-bridge";

const extensionRoot = path.join(__dirname, "..");
const asset = (name: string) => fs.readFileSync(path.join(extensionRoot, "assets", "www", "preview", name), "utf8");

function documentBridge(framed = true, token: string | undefined = "session-token") {
  // Run the shipped document script with a small DOM substitute. Capture the
  // installed listener so tests can inspect both messages and cancelled clicks.
  const messages: unknown[] = [];
  let click: ((event: unknown) => void) | undefined;
  class Element {
    // Model anchor attributes and nested content, including SVG's raw href.
    constructor(private readonly attributes: Record<string, string> = {}, private readonly anchor?: Element) { }
    closest() { return this.anchor ?? this; }
    getAttribute(name: string) { return this.attributes[name] ?? null; }
    hasAttribute(name: string) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  }
  const window = { parent: undefined as unknown };
  // Clone posted values as a browser message would, avoiding VM prototypes in
  // assertions. An unframed document is its own parent and must stay inactive.
  window.parent = framed ? { postMessage: (message: unknown) => messages.push(JSON.parse(JSON.stringify(message))) } : window;
  const globals: Record<string, unknown> = {
    window,
    document: {
      currentScript: token === undefined ? null : { getAttribute: () => token },
      addEventListener: (type: string, callback: (event: unknown) => void, capture: boolean) => {
        assert.strictEqual(type, "click");
        assert.strictEqual(capture, true);
        click = callback;
      },
    },
  };
  globals["Element"] = Element;
  // Execute the real asset rather than duplicating its click-handling logic.
  vm.runInNewContext(asset("command-links.js"), globals);
  return {
    messages,
    click: (attributes: Record<string, string>, options: { nested?: boolean; text?: boolean; prevented?: boolean } = {}) => {
      // Choose an anchor, nested element or text node as the event target.
      const anchor = new Element(attributes);
      const child = options.nested ? new Element({}, anchor) : anchor;
      const event = {
        target: options.text ? { parentElement: child } : child,
        defaultPrevented: options.prevented ?? false,
        stopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.stopped = true; },
      };
      click?.(event);
      return event;
    },
  };
}

function webviewRelay() {
  // Only initialize the real relay's message listener. Keep DOMContentLoaded
  // pending so unrelated navigation controls and timers do not run in this VM.
  const messages: unknown[] = [];
  let receive: (event: unknown) => void = () => assert.fail("Message listener missing");
  const frameWindow = {};
  // Window identity is independent of origin: a same-origin sibling must fail.
  const settings = { url: "https://editor.example/proxy/4321/index.html", commandToken: "session-token" };
  const control = { addEventListener() { } };
  const frame = { contentWindow: frameWindow };
  const document = {
    readyState: "loading",
    body: { classList: { remove() { } } },
    querySelector: (selector: string) => selector === "iframe" ? frame : { querySelector: () => control },
    getElementById: (id: string) => id === "simple-browser-settings" ? { getAttribute: () => JSON.stringify(settings) } : control,
    addEventListener() { },
  };
  const globals: Record<string, unknown> = {
    document,
    acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(JSON.parse(JSON.stringify(message))) }),
    window: { addEventListener: (_type: string, callback: typeof receive) => { receive = callback; } },
  };
  globals["URL"] = URL;
  vm.runInNewContext(asset("index.js"), globals);
  return {
    messages,
    receive: (data: unknown, source: unknown = frameWindow, origin = "https://editor.example") => receive({ data, source, origin }),
  };
}

suite("Preview command bridge", function () {
  test("creates separate session filters and removes temporary files on dispose", function () {
    const first = createPreviewCommandBridge(extensionRoot);
    const second = createPreviewCommandBridge(extensionRoot);
    const directory = path.dirname(first.metadataFile);
    try {
      // Separate invocations need separate tokens and temporary filter files.
      assert.notStrictEqual(first.token, second.token);
      const metadata = JSON.parse(fs.readFileSync(first.metadataFile, "utf8"));
      assert.strictEqual(metadata.filters.length, 1);
      const filter = fs.readFileSync(metadata.filters[0], "utf8");
      assert.ok(filter.includes(first.token));
      assert.ok(filter.includes('pandoc.RawBlock("html"'));
      assert.ok(filter.includes('FORMAT == "revealjs"'));
      first.dispose();
      assert.ok(!fs.existsSync(directory));
    } finally {
      // Also exercise repeated cleanup after the explicit disposal above.
      first.dispose();
      second.dispose();
    }
  });

  test("preserves query and readable arguments, including empty attributes", function () {
    // Both sources must reach the host intact so it can reject their conflict.
    const bridge = documentBridge();
    const href = "command:example?%5B%5D";
    const event = bridge.click(Object.fromEntries([["href", href], ["data-args", ""]]));
    assert.ok(event.defaultPrevented && event.stopped);
    assert.deepStrictEqual(bridge.messages, [{ type: "quarto.preview.command", token: "session-token", link: { href, dataArgs: "" } }]);
  });

  test("handles nested button content, text nodes and SVG-style links", function () {
    const bridge = documentBridge();
    bridge.click(Object.fromEntries([["href", "COMMAND:example"], ["data-args", '["100%"]']]), { nested: true });
    bridge.click({ href: "command:example" }, { text: true });
    bridge.click(Object.fromEntries([["xlink:href", "command:example"]]), { nested: true });
    assert.strictEqual(bridge.messages.length, 3);
  });

  test("leaves ordinary links and cancelled events alone", function () {
    const bridge = documentBridge();
    for (const href of ["#section", "chapter.html", "https://quarto.org", "mailto:reader@example.com"]) {
      assert.ok(!bridge.click({ href }).defaultPrevented);
    }
    bridge.click({ href: "command:example" }, { prevented: true });
    assert.deepStrictEqual(bridge.messages, []);
  });

  test("does not activate outside an iframe or without a session", function () {
    for (const bridge of [documentBridge(false), documentBridge(true, "")]) {
      assert.ok(!bridge.click({ href: "command:example" }).defaultPrevented);
      assert.deepStrictEqual(bridge.messages, []);
    }
  });

  test("relays only the expected document frame, origin and session", function () {
    const relay = webviewRelay();
    const message = { type: "quarto.preview.command", token: "session-token", link: { href: "command:example", dataArgs: "[]" } };
    // Change one provenance field at a time before sending the valid message.
    relay.receive(message, {});
    relay.receive(message, undefined, "https://foreign.example");
    relay.receive({ ...message, token: "another-preview" });
    assert.deepStrictEqual(relay.messages, []);
    relay.receive(message);
    assert.deepStrictEqual(relay.messages, [{ ...message, origin: "https://editor.example" }]);
  });

  test("rejects malformed browser payloads without disturbing ordinary messages", function () {
    const relay = webviewRelay();
    for (const link of [null, [], {}, { href: 1 }, { href: "command:example", dataArgs: null }]) {
      relay.receive({ type: "quarto.preview.command", token: "session-token", link });
    }
    assert.deepStrictEqual(relay.messages, []);
    // Command validation must leave the existing ordinary-link relay working.
    relay.receive({ type: "openExternal", url: "https://quarto.org" });
    assert.deepStrictEqual(relay.messages, [{ type: "openExternal", url: "https://quarto.org" }]);
  });

  test("host checks reject stale sessions, foreign origins and invalid payloads", function () {
    // Host validation repeats transport checks; an undefined token represents
    // a stopped session, while a new token represents a restarted preview.
    const message = { type: "quarto.preview.command", token: "session-token", origin: "https://editor.example", link: { href: "command:example", dataArgs: "" } };
    const url = "https://editor.example/proxy/4321/chapter.html";
    assert.strictEqual(isPreviewCommandMessage(message, "session-token", url), true);
    assert.strictEqual(isPreviewCommandMessage(message, "new-session", url), false);
    assert.strictEqual(isPreviewCommandMessage(message, undefined, url), false);
    assert.strictEqual(isPreviewCommandMessage({ ...message, origin: "https://foreign.example" }, "session-token", url), false);
    assert.strictEqual(isPreviewCommandMessage({ ...message, link: { href: "command:example", dataArgs: null } }, "session-token", url), false);
    assert.strictEqual(isPreviewCommandMessage(message, "session-token", "about:blank"), false);
    assert.strictEqual(isPreviewCommandMessage(message, "session-token", "invalid-url"), false);
  });
});
