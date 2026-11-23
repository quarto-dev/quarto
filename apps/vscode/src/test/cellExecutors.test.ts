import * as vscode from "vscode";
import * as assert from "assert";

import { isExecutableLanguageBlock, TokenCodeBlock, TokenMath } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";
import { codeWithoutOptionsFromBlock } from "../providers/cell/executors";
import type * as positron from "positron";
import {
  contributedRuntimeLanguages,
  hasPositronRuntime,
  onDidChangeRuntimeLanguages,
  trackRuntimeLanguagesWith,
} from "../host/positron";
import { TestLogOutputChannel } from "./fixtures/test-log-output-channel";

suite("Code sent for execution", function () {
  const engine = new MarkdownEngine();

  /**
   * Parses `content` as an in-memory Quarto document and returns the code of
   * its single executable cell, as it would be sent to an executor (without
   * the trailing newline, which isn't what's under test here). `runtimes` are
   * the languages that count as having a Positron runtime.
   */
  async function executedCode(content: string, runtimes: string[] = []): Promise<string> {
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content,
    });
    const blocks = engine.parse(doc).filter(isExecutableLanguageBlock);
    assert.strictEqual(blocks.length, 1, "expected exactly one executable cell");
    return codeWithoutOptionsFromBlock(
      blocks[0] as TokenMath | TokenCodeBlock,
      (language) => runtimes.includes(language)
    ).trimEnd();
  }

  test("strips *| options from a sas cell that a Positron runtime runs", async function () {
    assert.strictEqual(
      await executedCode("```{sas}\n*| label: a;\n*| echo: false;\nproc print data=sashelp.class; run;\n```", ["sas"]),
      "proc print data=sashelp.class; run;"
    );
  });

  test("strips #| options from a ggsql cell that a Positron runtime runs", async function () {
    // ggsql has no entry in kLangCommentChars, so its options are `#|`
    // lines, and `#` isn't a comment in ggsql
    assert.strictEqual(
      await executedCode("```{ggsql}\n#| label: a\n#| error: true\nVISUALISE x, y FROM df DRAW point\n```", ["ggsql"]),
      "VISUALISE x, y FROM df DRAW point"
    );
  });

  test("keeps the options of a language without a Positron runtime", async function () {
    assert.strictEqual(
      await executedCode("```{sas}\n*| label: a;\nproc print; run;\n```"),
      "*| label: a;\nproc print; run;"
    );
  });

  test("keeps option-like lines after the code of a runtime cell", async function () {
    assert.strictEqual(
      await executedCode("```{ggsql}\n#| label: a\nSELECT 1\n#| not an option\n```", ["ggsql"]),
      "SELECT 1\n#| not an option"
    );
  });

  test("strips #| options from a Python cell", async function () {
    assert.strictEqual(
      await executedCode("```{python}\n#| label: a\n#| echo: false\nx = 1\n```"),
      "x = 1"
    );
  });

  test("strips #| options from a bash cell", async function () {
    assert.strictEqual(
      await executedCode("```{bash}\n#| label: a\necho hi\n```"),
      "echo hi"
    );
  });

  test("keeps #| lines in a language whose options use other comment characters", async function () {
    // stata has an executor, but its cell options are written as `*|`; a `#|`
    // line is code, not an option, so it is sent as is
    assert.strictEqual(
      await executedCode("```{stata}\n#| label: a\ndisplay 1\n```"),
      "#| label: a\ndisplay 1"
    );
  });
});

suite("Languages with a Positron runtime", function () {
  test("reads the languageRuntimes contributions of extensions", function () {
    const languages = contributedRuntimeLanguages([
      { packageJSON: { contributes: { languageRuntimes: [{ languageId: "sas" }] } } },
      { packageJSON: { contributes: { languageRuntimes: [{ languageId: "ggsql" }, { languageId: "sas" }] } } },
      { packageJSON: { contributes: { languages: [{ id: "markdown" }] } } },
      { packageJSON: {} },
      { packageJSON: undefined },
    ]);
    assert.deepStrictEqual([...languages].sort(), ["ggsql", "sas"]);
  });

  test("ignores malformed languageRuntimes contributions", function () {
    const languages = contributedRuntimeLanguages([
      { packageJSON: { contributes: { languageRuntimes: { languageId: "sas" } } } },
      { packageJSON: { contributes: { languageRuntimes: [null, {}, { languageId: 1 }, { languageId: "" }] } } },
    ]);
    assert.deepStrictEqual([...languages], []);
  });

  /**
   * Fake runtime and extensions APIs for `trackRuntimeLanguagesWith`, and a
   * counter of how often `onDidChangeRuntimeLanguages` fires.
   */
  function fakeApis(registered: Thenable<string[]> = Promise.resolve([])) {
    const onDidRegisterRuntime = new vscode.EventEmitter<positron.LanguageRuntimeMetadata>();
    const onDidChangeExtensions = new vscode.EventEmitter<void>();
    const metadata = (languageId: string) => ({ languageId }) as positron.LanguageRuntimeMetadata;
    const fakes = {
      runtime: {
        getRegisteredRuntimes: () => registered.then((ids) => ids.map(metadata)),
        onDidRegisterRuntime: onDidRegisterRuntime.event,
      },
      contributions: [] as string[],
      extensions: {
        get all() {
          return fakes.contributions.map((languageId) => ({
            packageJSON: { contributes: { languageRuntimes: [{ languageId }] } },
          })) as unknown as readonly vscode.Extension<unknown>[];
        },
        onDidChange: onDidChangeExtensions.event,
      },
      registerRuntime: (languageId: string) => onDidRegisterRuntime.fire(metadata(languageId)),
      changeExtensions: (languageIds: string[]) => {
        fakes.contributions = languageIds;
        onDidChangeExtensions.fire();
      },
      changes: 0,
    };
    return fakes;
  }

  let tracking: vscode.Disposable | undefined;
  let listener: vscode.Disposable | undefined;

  function track(fakes: ReturnType<typeof fakeApis>, outputChannel?: vscode.LogOutputChannel) {
    listener = onDidChangeRuntimeLanguages(() => fakes.changes++);
    tracking = trackRuntimeLanguagesWith(fakes.runtime, fakes.extensions, outputChannel);
  }

  teardown(function () {
    tracking?.dispose();
    listener?.dispose();
    tracking = listener = undefined;
  });

  test("fires once when a runtime registers a new language", async function () {
    const fakes = fakeApis(Promise.resolve(["ggsql"]));
    track(fakes);
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(hasPositronRuntime("ggsql"));
    assert.strictEqual(fakes.changes, 1);

    fakes.registerRuntime("sas");
    assert.ok(hasPositronRuntime("sas"));
    assert.strictEqual(fakes.changes, 2);

    // a second runtime for a known language changes nothing
    fakes.registerRuntime("sas");
    assert.strictEqual(fakes.changes, 2);
  });

  test("fires when an extension change adds or removes a contributed language", function () {
    const fakes = fakeApis();
    track(fakes);
    assert.ok(!hasPositronRuntime("sas"));

    fakes.changeExtensions(["sas"]);
    assert.ok(hasPositronRuntime("sas"));
    assert.strictEqual(fakes.changes, 1);

    // an unrelated extension change doesn't fire
    fakes.changeExtensions(["sas"]);
    assert.strictEqual(fakes.changes, 1);

    fakes.changeExtensions([]);
    assert.ok(!hasPositronRuntime("sas"));
    assert.strictEqual(fakes.changes, 2);
  });

  test("doesn't fire when a contributed language registers its runtime", function () {
    const fakes = fakeApis();
    fakes.contributions = ["sas"];
    track(fakes);
    assert.ok(hasPositronRuntime("sas"));

    fakes.registerRuntime("sas");
    assert.strictEqual(fakes.changes, 0);
  });

  test("logs a failure to get the registered runtimes", async function () {
    const errors: string[] = [];
    const outputChannel = new TestLogOutputChannel();
    outputChannel.error = (value: string) => { errors.push(value); };
    track(fakeApis(Promise.reject(new Error("no runtimes"))), outputChannel);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual(errors, ["Failed to get registered runtimes: Error: no runtimes"]);
  });

  test("stops tracking when disposed", function () {
    const fakes = fakeApis();
    track(fakes);
    tracking?.dispose();

    fakes.registerRuntime("sas");
    fakes.changeExtensions(["ggsql"]);
    assert.ok(!hasPositronRuntime("sas"));
    assert.ok(!hasPositronRuntime("ggsql"));
    assert.strictEqual(fakes.changes, 0);
  });
});
