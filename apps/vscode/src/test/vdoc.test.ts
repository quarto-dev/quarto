import * as vscode from "vscode";
import * as assert from "assert";
import { readOrCreateSnapshot, openAndShowExamplesTextDocument } from "./test-utils";
import { MarkdownEngine } from "../markdown/engine";
import { virtualDoc, VirtualDocStyle } from "../vdoc/vdoc";
import path from "path";

suite("Virtual documents", function () {
  const engine = new MarkdownEngine();

  snapshotVirtualDocument(
    "vdoc/blocks-python.py",
    "vdoc/blocks.qmd",
    new vscode.Position(8, 0),
    engine,
    VirtualDocStyle.Language
  );
  snapshotVirtualDocument(
    "vdoc/blocks-r.R",
    "vdoc/blocks.qmd",
    new vscode.Position(16, 0),
    engine,
    VirtualDocStyle.Language
  );

  snapshotVirtualDocument(
    "vdoc/one-block.R",
    "vdoc/blocks.qmd",
    new vscode.Position(16, 0),
    engine,
    VirtualDocStyle.Block
  );

  test("OOB position returns `undefined` virtual doc", async function () {
    const { doc } = await openAndShowExamplesTextDocument("vdoc/oob.qmd");

    const position = new vscode.Position(0, 0);
    const style = VirtualDocStyle.Language;

    const vdoc = await virtualDoc(doc, position, engine, style);
    assert.strictEqual(vdoc, undefined);
  });
});

function snapshotVirtualDocument(
  snapshotFilename: string,
  filename: string,
  position: vscode.Position,
  engine: MarkdownEngine,
  style: VirtualDocStyle
) {
  test(`Virtual document ${filename} matches snapshot ${snapshotFilename}`, async function () {
    const { doc } = await openAndShowExamplesTextDocument(filename);

    const vdoc = await virtualDoc(doc, position, engine, style);
    assert.ok(vdoc);

    assert.equal(
      vdoc.content,
      await readOrCreateSnapshot(snapshotFilename, vdoc.content)
    );
  });
}
