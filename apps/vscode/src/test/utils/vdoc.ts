import assert from "assert";
import { Uri, workspace } from "vscode";
import { VIRTUAL_DOC_TEMP_DIRECTORY } from "../../vdoc/vdoc-tempfile";


/**
 * Assert that there are no virtual documents leaked after tests.
 */
export async function assertNoLeakedVirtualDocs() {
  await assertNoLocalVirtualDocs();
  await assertNoTempFileVirtualDocs();
}

/**
 * Assert that there are no virtual documents leaked in the workspace.
 */
async function assertNoLocalVirtualDocs() {
  const vdocFiles = await workspace.findFiles("**/.vdoc.*");
  assert.strictEqual(
    vdocFiles.length,
    0,
    `Expected no virtual doc files, but found ${vdocFiles.length}: ` +
    vdocFiles.map((uri) => uri.fsPath).join(", ")
  );
}

/**
 * Assert that there are no virtual documents leaked in the temp folder.
 */
async function assertNoTempFileVirtualDocs() {
  const tempDir = await workspace.fs.readDirectory(Uri.file(VIRTUAL_DOC_TEMP_DIRECTORY));
  const tempVdocFiles = tempDir.filter(([name]) => name.startsWith(".vdoc."));
  assert.strictEqual(
    tempVdocFiles.length,
    0,
    `Expected no virtual doc files in temp directory, ` +
    `but found ${tempVdocFiles.length}: ` +
    tempVdocFiles.map(([name]) => name).join(", ")
  );
}
