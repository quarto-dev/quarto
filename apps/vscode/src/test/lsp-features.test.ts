import * as vscode from "vscode";
import * as assert from "assert";
import { examplesUri, waitForCondition } from "./test-utils";

// Smoke tests for the features the Quarto language server provides itself
// (as opposed to the embedded-language middleware in the extension client),
// so that upgrades of vscode-languageclient/-server have end-to-end coverage.
// Definitions aren't covered: the server's definition handler is replaced by
// a stub that returns null (#1139).

const uri = examplesUri("lsp-features.qmd");

function positionOf(doc: vscode.TextDocument, needle: string, offset = 0) {
  const index = doc.getText().indexOf(needle);
  assert.ok(index >= 0, `"${needle}" not found in ${uri.fsPath}`);
  return doc.positionAt(index + offset);
}

async function poll<T>(
  what: string,
  query: () => Thenable<T | undefined>,
  ok: (result: T) => boolean
): Promise<T> {
  let result: T | undefined;
  await waitForCondition(
    async () => {
      result = await query();
      return result !== undefined && ok(result);
    },
    { timeout: 20000, interval: 250, message: what }
  );
  return result!;
}

function hoverText(hovers: vscode.Hover[]) {
  return hovers
    .flatMap((h) => h.contents)
    .map((c) => (typeof c === "string" ? c : c.value))
    .join("\n");
}

suite("Quarto LSP features", function () {
  let doc: vscode.TextDocument;

  suiteSetup(async function () {
    this.timeout(30000);
    doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  });

  test("crossref completions", async function () {
    this.timeout(30000);
    const list = await poll(
      "crossref completions",
      () => vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider", uri, positionOf(doc, "@sec-first", 1), "@"
      ),
      (list) => list.items.length > 0
    );
    const labels = list.items.map((i) => typeof i.label === "string" ? i.label : i.label.label);
    assert.ok(labels.includes("sec-first"), `labels: ${labels.join(", ")}`);
  });

  test("YAML completions", async function () {
    this.timeout(30000);
    const yamlDoc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "---\nexecute:\n  ec\n---\n",
    });
    const list = await poll(
      "YAML completions",
      () => vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider", yamlDoc.uri, new vscode.Position(2, 4)
      ),
      (list) => list.items.length > 0
    );
    const labels = list.items.map((i) => typeof i.label === "string" ? i.label : i.label.label);
    assert.ok(labels.includes("echo"), `labels: ${labels.join(", ")}`);
  });

  test("YAML hover", async function () {
    this.timeout(30000);
    const hovers = await poll(
      "YAML hover",
      () => vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider", uri, positionOf(doc, "title:", 1)
      ),
      (hovers) => hoverText(hovers).length > 0
    );
    assert.ok(/title/i.test(hoverText(hovers)), hoverText(hovers));
  });

  test("math hover", async function () {
    this.timeout(30000);
    const hovers = await poll(
      "math hover",
      () => vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider", uri, positionOf(doc, "x^2", 1)
      ),
      (hovers) => hoverText(hovers).length > 0
    );
    assert.ok(hoverText(hovers).includes("data:image/svg+xml"), hoverText(hovers));
  });

  test("YAML diagnostics", async function () {
    this.timeout(30000);
    await waitForCondition(
      () => vscode.languages.getDiagnostics(uri).length > 0,
      { timeout: 20000, message: "YAML diagnostics" }
    );
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const line = positionOf(doc, "echo: 42").line;
    assert.ok(
      diagnostics.some((d) => d.range.start.line === line),
      JSON.stringify(diagnostics.map((d) => [d.range.start.line, d.message]))
    );
  });

  test("document links, resolved", async function () {
    this.timeout(30000);
    const links = await poll(
      "document links",
      () => vscode.commands.executeCommand<vscode.DocumentLink[]>(
        "vscode.executeLinkProvider", uri, 10
      ),
      (links) => links.length > 0
    );
    const hello = links.find((l) => doc.getText(l.range) === "hello.qmd");
    assert.ok(hello, `links: ${links.map((l) => doc.getText(l.range)).join(", ")}`);
    assert.ok(hello.target?.toString().includes("hello.qmd"), hello.target?.toString());
  });

  test("folding ranges", async function () {
    this.timeout(30000);
    const ranges = await poll(
      "folding ranges",
      () => vscode.commands.executeCommand<vscode.FoldingRange[]>(
        "vscode.executeFoldingRangeProvider", uri
      ),
      (ranges) => ranges.length > 0
    );
    const cellLine = positionOf(doc, "```{python}").line;
    const sectionLine = positionOf(doc, "## First Section").line;
    const starts = ranges.map((r) => r.start);
    assert.ok(starts.includes(cellLine), `starts: ${starts.join(", ")}`);
    assert.ok(starts.includes(sectionLine), `starts: ${starts.join(", ")}`);
  });

  test("selection ranges", async function () {
    this.timeout(30000);
    const ranges = await poll(
      "selection ranges",
      () => vscode.commands.executeCommand<vscode.SelectionRange[]>(
        "vscode.executeSelectionRangeProvider", uri, [positionOf(doc, "Text.", 1)]
      ),
      (ranges) => ranges.length > 0 && !!ranges[0].parent
    );
    assert.strictEqual(ranges.length, 1);
  });

  test("references to a header", async function () {
    this.timeout(30000);
    const locations = await poll(
      "references",
      () => vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeReferenceProvider", uri, positionOf(doc, "First Section", 1)
      ),
      (locations) => locations.length > 0
    );
    const fragmentLine = positionOf(doc, "(#first-section)").line;
    assert.ok(
      locations.some((l) => l.range.start.line === fragmentLine),
      JSON.stringify(locations.map((l) => l.range.start.line))
    );
  });
});
