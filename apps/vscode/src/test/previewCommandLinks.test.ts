/*
 * previewCommandLinks.test.ts
 *
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import {
  dispatchPreviewCommand,
  parsePreviewCommandLink,
  PreviewCommandDispatchHost,
  PreviewCommandError,
  PreviewCommandErrorCode,
  revivePreviewCommandArguments,
} from "../providers/preview/command-links";
import { previewCommandPermission } from "../providers/preview/command-permissions";

function rejectsLink(link: unknown, code: PreviewCommandErrorCode) {
  // Check the stable error code rather than a raw JSON/URI parser exception.
  assert.throws(() => parsePreviewCommandLink(link), error =>
    error instanceof PreviewCommandError && error.code === code
  );
}

// These pure tests supply raw DOM attribute values. URI construction and real
// editor dispatch are covered separately by the extension-host suites.
suite("Preview command links", function () {
  test("accepts no arguments and preserves command ID casing", function () {
    assert.deepStrictEqual(parsePreviewCommandLink({ href: "COMMAND:Example.Action" }), {
      commandId: "Example.Action", args: [],
    });
  });

  test("encoded and readable arguments are equivalent", function () {
    const args = [{ scheme: "file", path: "/workspace/hello.qmd" }, 1, true, null];
    const json = JSON.stringify(args);
    const encoded = parsePreviewCommandLink({ href: `command:vscode.open?${encodeURIComponent(json)}` });
    const readable = parsePreviewCommandLink({ href: "command:vscode.open", dataArgs: json });
    assert.deepStrictEqual(encoded, readable);
    assert.deepStrictEqual(readable.args, args);
  });

  test("decodes queries once and preserves plus, percent and Unicode", function () {
    const args = ["100%", "%20", "+", "a+b", "café", "#fragment"];
    assert.deepStrictEqual(parsePreviewCommandLink({
      href: `command:example?${encodeURIComponent(JSON.stringify(args))}`,
    }).args, args);
    assert.deepStrictEqual(parsePreviewCommandLink({ href: 'command:example?["a+b"]' }).args, ["a+b"]);
    assert.deepStrictEqual(parsePreviewCommandLink({ href: "command:example", dataArgs: '["100%","%20"]' }).args, ["100%", "%20"]);
  });

  test("decodes encoded command IDs without folding their case", function () {
    assert.strictEqual(parsePreviewCommandLink({ href: "command:Example%2EAction" }).commandId, "Example.Action");
  });

  test("rejects malformed links, authorities and fragments", function () {
    for (const href of ["", "https://example.com", "command:", "command://host/action", "command:action#", "command:action#section", "command:a b", "command:a%20b", "command:a%00b", "command:bad%ZZ", "command:example?[]\n"]) {
      rejectsLink({ href }, "invalid-link");
    }
    for (const link of [null, [], "command:example", {}, { href: 1 }]) {
      rejectsLink(link, "invalid-link");
    }
  });

  test("rejects both argument sources even when identical or empty", function () {
    for (const [query, dataArgs] of [["%5B%5D", "[]"], ["", ""], ["%5B%5D", ""]]) {
      rejectsLink({ href: `command:example?${query}`, dataArgs }, "conflicting-arguments");
    }
  });

  test("rejects empty, malformed and non-array argument values", function () {
    for (const json of ["", "{", "{}", '"text"', "1", "true", "null"]) {
      rejectsLink({ href: `command:example?${encodeURIComponent(json)}` }, "invalid-arguments");
      rejectsLink({ href: "command:example", dataArgs: json }, "invalid-arguments");
    }
    rejectsLink({ href: "command:example?%ZZ" }, "invalid-arguments");
    rejectsLink({ href: "command:example?%C3%28" }, "invalid-arguments");
    for (const dataArgs of [null, undefined, [], {}]) {
      rejectsLink({ href: "command:example", dataArgs }, "invalid-arguments");
    }
  });

  test("does not use inherited link fields", function () {
    rejectsLink(Object.create({ href: "command:example" }), "invalid-link");
    const link = Object.assign(Object.create({ dataArgs: "[]" }), { href: "command:example?%5B%5D" });
    assert.deepStrictEqual(parsePreviewCommandLink(link).args, []);
  });

  test("revives URI components with and without the URI marker", function () {
    const components = { scheme: "file", authority: "", path: "/workspace/a b.qmd", query: "x=1", fragment: "title" };
    const seen: unknown[] = [];
    revivePreviewCommandArguments([
      components, { scheme: "file", path: "/example" }, { scheme: "file", $mid: 1 },
      { scheme: "custom", authority: "server", $mid: 1 },
      { ...components, $mid: 1, extra: "ignored" },
    ], uri => {
      seen.push(uri);
      return uri;
    });
    assert.deepStrictEqual(seen, [
      components, { scheme: "file", path: "/example" }, { scheme: "file" },
      { scheme: "custom", authority: "server" }, components,
    ]);
  });

  test("leaves ordinary objects, other markers and nested URIs untouched", function () {
    const args = [
      { path: "/workspace/hello.qmd" }, { scheme: 1 }, { scheme: "file", path: "/example", $mid: 2 },
      { scheme: "dark", marker: true }, { scheme: "dark" },
      // URI-like fields alone do not opt ordinary data into URI conversion.
      { scheme: "dark", query: "compact" }, { scheme: "custom", authority: "server" },
      { scheme: "dark", fragment: "section" },
      { scheme: "file", path: "/example", $mid: undefined },
      { scheme: "file", path: "/example", marker: true },
      [{ scheme: "file", path: "/nested" }], { nested: { scheme: "file" } },
    ];
    const result = revivePreviewCommandArguments(args, () => assert.fail("Unexpected URI conversion"));
    // Preserve the original objects, including fields unrelated to URI handling.
    result.forEach((value, index) => assert.strictEqual(value, args[index]));
  });

  test("rejects invalid URI schemes and component types", function () {
    for (const arg of [{ scheme: "", path: "" }, { scheme: "1invalid", path: "" }, { scheme: "bad scheme", path: "" }, { $mid: 1 }, { scheme: 1, $mid: 1 }, { scheme: "file", path: 1 }, { scheme: "file", path: "", authority: null }, { scheme: "file", $mid: 1, query: false }, { scheme: "file", path: "", fragment: [] }]) {
      assert.throws(() => revivePreviewCommandArguments([arg], uri => uri), error =>
        error instanceof PreviewCommandError && error.code === "invalid-uri"
      );
    }
  });

  test("replaces raw URI errors with a fixed message", function () {
    assert.throws(() => revivePreviewCommandArguments([{ scheme: "file", $mid: 1 }], () => {
      throw new Error("secret-uri-value");
    }), error => error instanceof PreviewCommandError && error.message === "Invalid URI argument in preview command link.");
  });
});

suite("Preview command dispatch", function () {
  test("spreads positional arguments into one command invocation", async function () {
    const calls: unknown[] = [];
    const result = await dispatchPreviewCommand({ href: "command:example", dataArgs: '["text",42,true,null]' }, {
      createUri: uri => uri,
      permission: () => "allowed",
      executeCommand: async (...args) => { calls.push(args); return "private-result"; },
    });
    assert.deepStrictEqual(calls, [["example", "text", 42, true, null]]);
    assert.deepStrictEqual(result, { status: "executed" });
  });

  test("preserves ordinary scheme objects through both argument forms", async function () {
    const args = ["lab.actions", { scheme: "dark", marker: true }];
    const json = JSON.stringify(args);
    for (const link of [
      { href: `command:setContext?${encodeURIComponent(json)}` },
      { href: "command:setContext", dataArgs: json },
    ]) {
      const calls: unknown[][] = [];
      const result = await dispatchPreviewCommand(link, {
        createUri: () => assert.fail("Ordinary command data was converted to a URI"),
        permission: () => "allowed",
        executeCommand: async (...received) => { calls.push(received); },
      });
      assert.deepStrictEqual(result, { status: "executed" });
      assert.deepStrictEqual(calls, [["setContext", ...args]]);
    }
  });

  test("denies execution for every permission failure", async function () {
    for (const permission of ["not-allowed", "untrusted-workspace", "invalid-configuration"] as const) {
      const result = await dispatchPreviewCommand({ href: "command:example" }, {
        createUri: uri => uri,
        permission: () => permission,
        executeCommand: async () => assert.fail("Blocked command executed"),
      });
      assert.deepStrictEqual(result, { status: "blocked", permission });
    }
  });

  test("never executes malformed arguments or partially converted arrays", async function () {
    for (const link of [
      { href: "command:example?%ZZ" },
      { href: "command:example?%5B%5D", dataArgs: "[]" },
      { href: "command:example", dataArgs: '[{"scheme":"file","path":"/valid"},{"scheme":"file","path":1}]' },
    ]) {
      const result = await dispatchPreviewCommand(link, {
        createUri: uri => uri,
        permission: () => "allowed",
        executeCommand: async () => assert.fail("Invalid command executed"),
      });
      assert.strictEqual(result.status, "invalid");
    }
  });

  test("checks current permission after URI conversion", async function () {
    // A change during validation must be visible to the final permission check.
    let allowed = true;
    const result = await dispatchPreviewCommand({ href: "command:example", dataArgs: '[{"scheme":"file","path":"/example"}]' }, {
      createUri: uri => { allowed = false; return uri; },
      permission: () => allowed ? "allowed" : "not-allowed",
      executeCommand: async () => assert.fail("Revoked command executed"),
    });
    assert.deepStrictEqual(result, { status: "blocked", permission: "not-allowed" });
  });

  test("applies User permissions and trust without workspace fallback", async function () {
    const setting = { key: "quarto.preview.allowedCommands", globalValue: ["example"], workspaceValue: ["other"] };
    let trusted = true;
    let calls = 0;
    const host: PreviewCommandDispatchHost = {
      createUri: uri => uri,
      permission: id => previewCommandPermission(id, trusted, setting),
      executeCommand: async () => { calls++; },
    };
    assert.deepStrictEqual(await dispatchPreviewCommand({ href: "command:example" }, host), { status: "executed" });
    assert.strictEqual((await dispatchPreviewCommand({ href: "command:other" }, host)).status, "blocked");
    setting.globalValue = [];
    assert.strictEqual((await dispatchPreviewCommand({ href: "command:example" }, host)).status, "blocked");
    setting.globalValue = ["example"];
    trusted = false;
    assert.strictEqual((await dispatchPreviewCommand({ href: "command:example" }, host)).status, "blocked");
    assert.strictEqual(calls, 1);
  });

  test("authorizes only the outer composite command and preserves its arguments", async function () {
    const args = [{ commands: [{ command: "not.individually.allowed", args: [{ scheme: "file", path: "/nested" }] }] }];
    const checked: string[] = [];
    const result = await dispatchPreviewCommand({ href: "command:runCommands", dataArgs: JSON.stringify(args) }, {
      createUri: () => assert.fail("Nested URI was converted"),
      permission: id => { checked.push(id); return id === "runCommands" ? "allowed" : "not-allowed"; },
      executeCommand: async (id, ...received) => { assert.strictEqual(id, "runCommands"); assert.deepStrictEqual(received, args); },
    });
    assert.deepStrictEqual(checked, ["runCommands"]);
    assert.deepStrictEqual(result, { status: "executed" });
  });

  test("hides synchronous and asynchronous execution errors", async function () {
    for (const executeCommand of [
      () => { throw new Error("secret-sync-error"); },
      async () => { throw new Error("secret-async-error"); },
      async () => { throw new PreviewCommandError("invalid-link"); },
    ]) {
      const result = await dispatchPreviewCommand({ href: "command:example" }, {
        createUri: uri => uri, permission: () => "allowed", executeCommand,
      });
      assert.deepStrictEqual(result, { status: "failed" });
    }
  });

  test("hides unexpected permission lookup failures", async function () {
    const result = await dispatchPreviewCommand({ href: "command:example" }, {
      createUri: uri => uri,
      permission: () => { throw new Error("secret-setting-error"); },
      executeCommand: async () => assert.fail("Command executed after a failed permission check"),
    });
    assert.deepStrictEqual(result, { status: "failed" });
  });
});
