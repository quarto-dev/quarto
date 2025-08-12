import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, readOrCreateSnapshot, examplesOutUri, wait, roundtrip, openAndShowTextDocument } from "./test-utils";
import { isQuartoDoc } from "../core/doc";


suite("Quarto basics", function () {
  // Before running tests, copy `./examples` to a new folder `./examples-out`.
  // We copy to examples-out because the tests modify the files.
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  test("Can open a Quarto document", async function () {
    const { editor } = await openAndShowTextDocument("hello.qmd");

    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(isQuartoDoc(editor?.document), true);
  });

  // Note: this test runs after the previous test, so `hello.qmd` can already be touched by the previous
  //       test. That's okay for this test, but could cause issues if you expect a qmd to look how it
  //       does in `/examples`.
  test("Roundtrip doesn't change hello.qmd", async function () {
    const { doc } = await openAndShowTextDocument("hello.qmd");

    const { before, after } = await roundtrip(doc);

    assert.equal(before, after);
  });

  test("Roundtrip changes roundtrip-changes.qmd", async function () {
    // We want this test to fail locally so that we can reference the
    // before/affter diff that Mocha logs, but we dont wan't CI to fail.
    if (process.env['CI']) this.skip();

    const { doc } = await openAndShowTextDocument("roundtrip-changes.qmd");

    const { before, after } = await roundtrip(doc);

    assert.equal(before, after);
  });

  test("Roundtripped valid-basics.qmd matches snapshot", async function () {
    const { doc } = await openAndShowTextDocument("valid-basics.qmd");

    const { after } = await roundtrip(doc);

    assert.equal(after, await readOrCreateSnapshot("roundtripped-valid-basics.qmd", after));
  });

  test("Roundtripped invalid.qmd matches snapshot", async function () {
    const { doc } = await openAndShowTextDocument("invalid.qmd");

    const { after } = await roundtrip(doc);

    assert.equal(after, await readOrCreateSnapshot("roundtripped-invalid.qmd", after));
  });
  test("Roundtripped capsule-leak.qmd matches snapshot", async function () {
    const { doc } = await openAndShowTextDocument("capsule-leak.qmd");

    const { after } = await roundtrip(doc);

    assert.equal(after, await readOrCreateSnapshot("roundtripped-capsule-leak.qmd", after));
  });
});
