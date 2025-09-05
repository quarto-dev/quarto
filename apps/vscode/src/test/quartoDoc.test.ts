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

  roundtripSnapshotTest('valid-basics.qmd');

  roundtripSnapshotTest('valid-basics-2.qmd');

  roundtripSnapshotTest('valid-nesting.qmd');

  roundtripSnapshotTest('invalid.qmd');

  roundtripSnapshotTest('capsule-leak.qmd');

  roundtripSnapshotTest('attr-equals.qmd');
});

/**
 *
 * When the test is run on the dev's machine for the first time, saves the roundtripped file as a snapshot.
 * All subsequent runs of the test compare the roundtripped file to that snapshot.
 *
 * Useful for capturing the behaviour of roundtripping at a point in time and testing against that.
 *
 * @param filename A .qmd file in the examples folder to snapshot test
 */
function roundtripSnapshotTest(filename: string) {
  const snapshotFileName = `roundtripped-${filename}`;

  test(`Roundtripped ${filename} matches snapshot`, async function () {
    const { doc } = await openAndShowTextDocument(filename);

    const { after } = await roundtrip(doc);

    assert.equal(after, await readOrCreateSnapshot(snapshotFileName, after));
  });
}
