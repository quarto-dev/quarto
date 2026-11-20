import * as vscode from "vscode";
import * as assert from "assert";

import { isExecutableLanguageBlock, TokenCodeBlock, TokenMath } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";
import {
  blockIsExecutable,
  codeWithoutOptions,
  codeWithoutOptionsFromBlock,
  documentExecutableLanguages,
} from "../providers/cell/executors";
import { ExtensionHost } from "../host";
import type * as positron from "positron";
import {
  contributedRuntimeLanguages,
  hasPositronRuntime,
  hostCellRuntimeLanguages,
  hostExplainUnrunnableCell,
  onDidChangeRuntimeLanguages,
  positronExtensionHost,
  trackRuntimeLanguagesWith,
} from "../host/positron";
import {
  kHostCellRuntimeLanguagesCommand,
  kHostExplainUnrunnableCellCommand,
  onDidRefreshHostCellLanguages,
  refreshHostCellLanguages,
} from "../host/cell-features";
import { TestLogOutputChannel } from "./fixtures/test-log-output-channel";
import { cellOptions } from "../providers/cell/options";

suite("Code sent for execution", function () {
  const engine = new MarkdownEngine();

  /**
   * Parses `content` as an in-memory Quarto document and returns the code of
   * its single executable cell, as it would be sent to an executor (without
   * the trailing newline, which isn't what's under test here).
   */
  async function executedCode(content: string): Promise<string> {
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content,
    });
    const blocks = engine.parse(doc).filter(isExecutableLanguageBlock);
    assert.strictEqual(blocks.length, 1, "expected exactly one executable cell");
    return codeWithoutOptionsFromBlock(blocks[0] as TokenMath | TokenCodeBlock).trimEnd();
  }

  test("strips *| options from a sas cell", async function () {
    assert.strictEqual(
      await executedCode("```{sas}\n*| label: a;\n*| echo: false;\nproc print data=sashelp.class; run;\n```"),
      "proc print data=sashelp.class; run;"
    );
  });

  test("strips #| options from a ggsql cell, as quarto-cli and the ggsql docs write them", async function () {
    // ggsql's options are `--|`, but quarto-cli reads `#|` for ggsql, and `#`
    // isn't a comment in ggsql, so these lines must not reach the console
    assert.strictEqual(
      await executedCode("```{ggsql}\n#| label: a\n#| error: true\nVISUALISE x, y FROM df DRAW point\n```"),
      "VISUALISE x, y FROM df DRAW point"
    );
  });

  test("reads ggsql cell options written with #| or --|", function () {
    assert.deepStrictEqual(cellOptions("ggsql", ["#| eval: false", "select 1"]), { eval: false });
    assert.deepStrictEqual(cellOptions("ggsql", ["--| eval: false", "select 1"]), { eval: false });
    // sql has no such alternative: a `#|` line there is code
    assert.deepStrictEqual(cellOptions("sql", ["#| eval: false", "select 1"]), {});
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

  test("strips --| options from a ggsql cell, uncovering a -- @connect line", async function () {
    // the ggsql kernel only honors `-- @connect:` among a cell's leading lines
    assert.strictEqual(
      await executedCode("```{ggsql}\n--| label: plot\n--| echo: false\n-- @connect: duckdb://memory\nvisualise x from t draw point\n```"),
      "-- @connect: duckdb://memory\nvisualise x from t draw point"
    );
  });

  test("strips --| options from a sql cell, and only the leading ones", async function () {
    assert.strictEqual(
      await executedCode("```{sql}\n--|label: q\nselect 1\n--| not an option\n```"),
      "select 1\n--| not an option"
    );
  });

  test("keeps #| lines in a sql cell, whose options are written --|", async function () {
    assert.strictEqual(
      await executedCode("```{sql}\n#| label: q\nselect 1\n```"),
      "#| label: q\nselect 1"
    );
  });

  test("leaves a cell without options as it is", async function () {
    assert.strictEqual(await executedCode("```{sql}\nselect 1\n```"), "select 1");
    assert.strictEqual(await executedCode("```{python}\nx = 1\n```"), "x = 1");
  });

  test("sends nothing for a cell of only options", async function () {
    assert.strictEqual(await executedCode("```{python}\n#| label: a\n```"), "");
    assert.strictEqual(await executedCode("```{ggsql}\n--| label: a\n```"), "");
  });

  test("strips options from a visual editor block's code by its language", function () {
    // a visual editor block's code is the cell's body, options included
    assert.strictEqual(
      codeWithoutOptions("ggsql", "--| label: plot\n-- @connect: duckdb://memory\nselect 1"),
      "-- @connect: duckdb://memory\nselect 1"
    );
    assert.strictEqual(codeWithoutOptions("python", "#| echo: false\nx = 1"), "x = 1");
    assert.strictEqual(codeWithoutOptions("python", "x = 1"), "x = 1");
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

suite("Cells the host runs", function () {
  const engine = new MarkdownEngine();

  const kQmd = [
    "```{python}",
    "x = 1",
    "```",
    "",
    "```{sql}",
    "select 1",
    "```",
    "",
    "```{ggsql}",
    "--| label: plot",
    "visualise x from t draw point",
    "```",
    "",
    "```{mermaid}",
    "graph LR",
    "```",
  ].join("\n");

  async function parse(content: string) {
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    return { doc, tokens: engine.parse(doc) };
  }

  /**
   * Registers a stand in for Positron's runtime languages command that answers
   * `answer(languages)`, recording each call, and refreshes the cached probe so
   * that the extension sees it. `dispose` unregisters it and refreshes again.
   */
  async function stubRuntimeLanguages(answer: (languages: string[]) => unknown) {
    const calls: unknown[][] = [];
    const command = vscode.commands.registerCommand(
      kHostCellRuntimeLanguagesCommand,
      (...args: unknown[]) => {
        calls.push(args);
        return answer(args[1] as string[]);
      }
    );
    await refreshHostCellLanguages();
    return {
      calls,
      dispose: async () => {
        command.dispose();
        await refreshHostCellLanguages();
      },
    };
  }

  /** Answers like Positron in a Jupyter document: it runs sql and ggsql. */
  const runsSqlAndGgsql = (languages: string[]) => Object.fromEntries(
    languages
      .filter((l) => l === "sql" || l === "ggsql")
      .map((l) => [l, "ggsql"])
  );

  test("a host without hostExecutableLanguages adds nothing", async function () {
    const { doc, tokens } = await parse(kQmd);
    const host = {} as ExtensionHost;
    const languages = await documentExecutableLanguages(host, doc, tokens);
    assert.ok(languages.has("python"));
    assert.ok(!languages.has("sql"));
    assert.ok(!languages.has("ggsql"));
  });

  test("adds the languages the host runs, asking once about every cell language", async function () {
    const { doc, tokens } = await parse(kQmd);
    const asked: string[][] = [];
    const host = {
      hostExecutableLanguages: async (_doc: vscode.TextDocument, languages: string[]) => {
        asked.push(languages);
        return languages.filter((l) => l === "sql" || l === "ggsql");
      },
    } as unknown as ExtensionHost;
    const languages = await documentExecutableLanguages(host, doc, tokens);
    assert.ok(languages.has("python"));
    assert.ok(languages.has("sql"));
    assert.ok(languages.has("ggsql"));
    assert.ok(!languages.has("mermaid"));
    assert.deepStrictEqual(asked, [["python", "sql", "ggsql", "mermaid"]]);

    const executable = tokens.filter((t) => blockIsExecutable(languages, t));
    assert.strictEqual(executable.length, 3);
  });

  test("asks Positron's batch command and keeps only the languages it runs", async function () {
    const { doc } = await parse(kQmd);
    const stub = await stubRuntimeLanguages((languages) => ({
      ...runsSqlAndGgsql(languages),
      notAsked: "ggsql",
      mermaid: 42,
    }));
    try {
      const runtimes = await hostCellRuntimeLanguages(doc, ["sql", "ggsql", "mermaid", "constructor"]);
      assert.deepStrictEqual({ ...runtimes }, { sql: "ggsql", ggsql: "ggsql" });
      assert.strictEqual(runtimes["constructor"], undefined);
      assert.strictEqual(stub.calls.length, 1);
      assert.strictEqual(String(stub.calls[0][0]), doc.uri.toString());
      assert.deepStrictEqual(stub.calls[0][1], ["sql", "ggsql", "mermaid", "constructor"]);
    } finally {
      await stub.dispose();
    }
  });

  test("Positron asks once per document version, leaving out its own runtimes", async function () {
    const { doc, tokens } = await parse(kQmd);
    const stub = await stubRuntimeLanguages(runsSqlAndGgsql);
    try {
      const host = positronExtensionHost();
      const languages = await documentExecutableLanguages(host, doc, tokens);
      assert.ok(languages.has("sql") && languages.has("ggsql") && !languages.has("mermaid"));

      // a run of a cell, a second pass, and a question about a subset are
      // all answered from the first call
      assert.ok(await host.cellExecutorForLanguage("sql", doc, engine, true));
      assert.ok(await host.cellExecutorForLanguage("ggsql", doc, engine, true));
      await documentExecutableLanguages(host, doc, tokens);
      assert.strictEqual(stub.calls.length, 1);
      assert.deepStrictEqual(stub.calls[0][1], ["sql", "ggsql", "mermaid"]);

      // a re-query of the host (any configuration or extension change) drops
      // the cached answer
      await refreshHostCellLanguages();
      await documentExecutableLanguages(host, doc, tokens);
      assert.strictEqual(stub.calls.length, 2);

      // and so does an edit, which is how the front matter changes
      const edit = new vscode.WorkspaceEdit();
      edit.insert(doc.uri, new vscode.Position(0, 0), "\n");
      assert.ok(await vscode.workspace.applyEdit(edit));
      await documentExecutableLanguages(host, doc, engine.parse(doc));
      assert.strictEqual(stub.calls.length, 3);
    } finally {
      await stub.dispose();
    }
  });

  test("Positron does not ask when every cell runs in its own runtimes", async function () {
    const { doc, tokens } = await parse("```{python}\nx = 1\n```\n\n```{r}\nx <- 1\n```");
    const stub = await stubRuntimeLanguages(runsSqlAndGgsql);
    try {
      const host = positronExtensionHost();
      await documentExecutableLanguages(host, doc, tokens);
      assert.ok(await host.cellExecutorForLanguage("python", doc, engine, true));
      assert.strictEqual(stub.calls.length, 0);
    } finally {
      await stub.dispose();
    }
  });

  test("Positron runs nothing extra when it has no such command", async function () {
    const { doc, tokens } = await parse(kQmd);
    await refreshHostCellLanguages();
    const host = positronExtensionHost();
    assert.deepStrictEqual({ ...await hostCellRuntimeLanguages(doc, ["sql"]) }, {});
    const languages = await documentExecutableLanguages(host, doc, tokens);
    assert.ok(!languages.has("sql") && !languages.has("ggsql"));
    // and falls back to this extension's own executors, which have none for sql
    assert.strictEqual(await host.cellExecutorForLanguage("sql", doc, engine, true), undefined);
  });

  test("Positron sees a runtime languages command registered after the last re-query", async function () {
    const { doc, tokens } = await parse(kQmd);
    await refreshHostCellLanguages();
    const command = vscode.commands.registerCommand(
      kHostCellRuntimeLanguagesCommand,
      (_uri: unknown, languages: string[]) => runsSqlAndGgsql(languages)
    );
    try {
      // no re-query in between: the command is called, not probed for
      const languages = await documentExecutableLanguages(positronExtensionHost(), doc, tokens);
      assert.ok(languages.has("sql") && languages.has("ggsql"));
    } finally {
      command.dispose();
      await refreshHostCellLanguages();
    }
  });

  test("Positron remembers that it has no runtime languages command until the next re-query", async function () {
    const { doc } = await parse(kQmd);
    await refreshHostCellLanguages();
    assert.deepStrictEqual({ ...await hostCellRuntimeLanguages(doc, ["sql"]) }, {});

    const calls: unknown[][] = [];
    const command = vscode.commands.registerCommand(
      kHostCellRuntimeLanguagesCommand,
      (...args: unknown[]) => {
        calls.push(args);
        return runsSqlAndGgsql(args[1] as string[]);
      }
    );
    try {
      // the command was just found missing, so it isn't tried again yet
      assert.deepStrictEqual({ ...await hostCellRuntimeLanguages(doc, ["sql"]) }, {});
      assert.strictEqual(calls.length, 0);

      // a re-query of the host (any configuration or extension change) tries again
      await refreshHostCellLanguages();
      assert.deepStrictEqual({ ...await hostCellRuntimeLanguages(doc, ["sql"]) }, { sql: "ggsql" });
      assert.strictEqual(calls.length, 1);
    } finally {
      command.dispose();
      await refreshHostCellLanguages();
    }
  });

  test("a listener for the host re-query, added after the host, gets a fresh answer", async function () {
    // a visual editor listens for the re-query, and asks again from the cache
    // right away: the cache must be dropped before that listener runs
    const { doc, tokens } = await parse(kQmd);
    let runs = true;
    const stub = await stubRuntimeLanguages((languages) => runs ? runsSqlAndGgsql(languages) : {});
    const host = positronExtensionHost();
    let reasked: Promise<ReadonlySet<string>> | undefined;
    const listener = onDidRefreshHostCellLanguages(() => {
      reasked = documentExecutableLanguages(host, doc, tokens);
    });
    try {
      assert.ok((await documentExecutableLanguages(host, doc, tokens)).has("sql"));
      runs = false;
      await refreshHostCellLanguages();
      assert.ok(reasked, "the listener should have run");
      assert.ok(!(await reasked!).has("sql"), "the listener should see the new answer");
    } finally {
      listener.dispose();
      await stub.dispose();
    }
  });

  test("Positron asks again after a failed answer", async function () {
    const { doc, tokens } = await parse(kQmd);
    let fail = true;
    const stub = await stubRuntimeLanguages((languages) => {
      if (fail) {
        throw new Error("boom");
      }
      return runsSqlAndGgsql(languages);
    });
    try {
      const host = positronExtensionHost();
      assert.ok(!(await documentExecutableLanguages(host, doc, tokens)).has("sql"));
      fail = false;
      // same document version, but the failure was not cached
      assert.ok((await documentExecutableLanguages(host, doc, tokens)).has("sql"));
      assert.strictEqual(stub.calls.length, 2);
    } finally {
      await stub.dispose();
    }
  });

  test("Positron hands a cell it runs to a Positron executor", async function () {
    const { doc } = await parse(kQmd);
    const stub = await stubRuntimeLanguages(runsSqlAndGgsql);
    try {
      const executor = await positronExtensionHost().cellExecutorForLanguage("sql", doc, engine, true);
      assert.ok(executor, "expected an executor for a cell Positron runs");
      assert.ok(executor!.executeInlineCells, "expected a Positron executor");
    } finally {
      await stub.dispose();
    }
  });
});

suite("Cells the host explains it cannot run", function () {
  async function quartoDoc() {
    return await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "---\nengine: knitr\n---\n\n```{sql}\nselect 1\n```\n",
    });
  }

  /** Registers a stand in for Positron's explain command answering `answer`. */
  async function stubExplain(answer: () => unknown) {
    const calls: unknown[][] = [];
    const command = vscode.commands.registerCommand(
      kHostExplainUnrunnableCellCommand,
      (...args: unknown[]) => {
        calls.push(args);
        return answer();
      }
    );
    await refreshHostCellLanguages();
    return {
      calls,
      dispose: async () => {
        command.dispose();
        await refreshHostCellLanguages();
      },
    };
  }

  test("explains nothing when Positron has no such command", async function () {
    await refreshHostCellLanguages();
    const doc = await quartoDoc();
    assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
    assert.strictEqual(await positronExtensionHost().explainNoExecutor!("sql", doc), false);
  });

  test("asks Positron to explain, and reports whether it did", async function () {
    const doc = await quartoDoc();
    let explained: unknown = true;
    const stub = await stubExplain(() => explained);
    try {
      assert.strictEqual(await positronExtensionHost().explainNoExecutor!("sql", doc), true);
      assert.strictEqual(String(stub.calls[0][0]), doc.uri.toString());
      assert.strictEqual(stub.calls[0][1], "sql");

      explained = false;
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
      explained = "yes";
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
    } finally {
      await stub.dispose();
    }
  });

  test("sees a command registered after the host was last probed", async function () {
    await refreshHostCellLanguages();
    const doc = await quartoDoc();
    const command = vscode.commands.registerCommand(kHostExplainUnrunnableCellCommand, () => true);
    try {
      // no re-query in between: the probe is made when the explanation is needed
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), true);
    } finally {
      command.dispose();
    }
  });

  test("treats a failing command as no explanation", async function () {
    const doc = await quartoDoc();
    const stub = await stubExplain(() => { throw new Error("boom"); });
    try {
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
    } finally {
      await stub.dispose();
    }
  });
});
