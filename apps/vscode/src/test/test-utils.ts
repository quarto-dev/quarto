import { DisposableStore } from "core";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { deleteDocument } from "../vdoc/vdoc-tempfile";


/**
 * Path to the root directory of the extension:
 * https://github.com/microsoft/vscode-python-tools-extension-template/blob/main/src/common/constants.ts
 */
export const EXTENSION_ROOT_DIR =
  path.basename(__dirname) === "common"
    ? path.dirname(path.dirname(__dirname))
    : path.dirname(__dirname);

export const TEST_PATH = path.join(EXTENSION_ROOT_DIR, "src", "test");
export const WORKSPACE_PATH = path.join(TEST_PATH, "examples");
export const WORKSPACE_OUT_PATH = path.join(TEST_PATH, "examples-out");

export function examplesUri(fileName: string = ''): vscode.Uri {
  return vscode.Uri.file(path.join(WORKSPACE_PATH, fileName));
}
export function examplesOutUri(fileName: string = ''): vscode.Uri {
  return vscode.Uri.file(path.join(WORKSPACE_OUT_PATH, fileName));
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Polls `condition` until it returns true or `timeout` elapses. Useful for
 * waiting on asynchronous, eventually-consistent state such as the Quarto LSP
 * finishing its (now lazy) startup and indexing before making assertions.
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  { timeout = 15000, interval = 100, message = "condition" }: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const start = Date.now();
  for (; ;) {
    if (await condition()) {
      return;
    }
    if (Date.now() - start >= timeout) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${message}`);
    }
    await wait(interval);
  }
}

/**
 * Waits until the (lazily started) Quarto LSP is running and has indexed the
 * workspace, detected by the presence of a known workspace symbol. Sets
 * `symbols.exportToWorkspace` to "all" so the probe symbol is visible
 * regardless of project type (e.g. R projects filter symbols by default).
 */
export async function waitForWorkspaceSymbol(name: string) {
  await vscode.workspace
    .getConfiguration("quarto")
    .update("symbols.exportToWorkspace", "all");
  await waitForCondition(
    async () => {
      const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        "vscode.executeWorkspaceSymbolProvider",
        ""
      );
      return !!symbols?.find((s) => s.name === name);
    },
    { message: `Quarto LSP workspace symbol "${name}"` }
  );
}

export async function openAndShowExamplesTextDocument(
  fileName: string,
  showOptions?: vscode.TextDocumentShowOptions
) {
  return openAndShowUri(examplesUri(fileName), showOptions);
}

export async function openAndShowExamplesOutTextDocument(
  fileName: string,
  showOptions?: vscode.TextDocumentShowOptions
) {
  return openAndShowUri(examplesOutUri(fileName), showOptions);
}

export async function openAndShowUri(
  uri: vscode.Uri,
  showOptions?: vscode.TextDocumentShowOptions
) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, showOptions);
  return { doc, editor };
}

/**
 * Creates a unique on-disk copy of an example file and registers a callback
 * with a disposable store to delete the copy on dispose.
 *
 * Use this instead of `openAndShowExamplesTextDocument` when a test exercises a
 * provider command that caches results per document URI, such as
 * `vscode.executeDocumentSymbolProvider` (VS Code's `OutlineModel` cache). If
 * several tests reuse the same example file, a stale cached result from a
 * previous test (or another suite that opened the same file) can be served
 * instead of re-invoking the provider, leaking the previous test's results and
 * dropping the current test's. A fresh URI per test guarantees the provider
 * actually runs.
 *
 * The copy is created alongside the original example file so workspace-relative
 * behavior (LSP, configuration) is preserved. Always dispose `disposables` in
 * the `teardown` hook.
 */
export async function openAndShowUniqueExamplesDocument(fileName: string, disposables: DisposableStore) {
  const doc = await openUniqueExamplesDocument(fileName, disposables);
  const editor = await vscode.window.showTextDocument(doc);
  return { doc, editor };
}

export async function openUniqueExamplesDocument(fileName: string, disposables: DisposableStore) {
  const sourceUri = examplesUri(fileName);
  const extension = path.extname(fileName);
  const uniqueName = `${path.basename(fileName, extension)}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const uniqueUri = vscode.Uri.joinPath(sourceUri, "..", uniqueName);
  fs.copyFileSync(sourceUri.fsPath, uniqueUri.fsPath);
  const doc = await vscode.workspace.openTextDocument(uniqueUri);

  /**
   * Ensure that the copy is deleted on dispose (usually, on test `teardown`).
   * See the notes in {@link deleteDocument} for why we have to use that function.
   */
  disposables.add({ dispose: () => deleteDocument(doc) });

  return doc;
}

export const APPROX_TIME_TO_OPEN_VISUAL_EDITOR = 1700;
export async function roundtrip(doc: vscode.TextDocument) {
  const before = doc.getText();

  // switch to visual editor and back
  await vscode.commands.executeCommand("quarto.test_setkVisualModeConfirmedTrue");
  await wait(300);
  await vscode.commands.executeCommand("quarto.editInVisualMode");
  await wait(APPROX_TIME_TO_OPEN_VISUAL_EDITOR);
  await vscode.commands.executeCommand("quarto.editInSourceMode");
  await waitForSourceEditor(doc);

  const after = doc.getText();

  return { before, after };
}

/**
 * Waits until `doc` is showing in the active text editor again after a switch
 * back to source mode.
 *
 * `quarto.editInSourceMode` returns before the source editor has been reopened:
 * it closes the visual editor and then reopens the text document in a callback
 * that the command does not await (see `reopenEditorInSourceMode`). Without
 * waiting for the reopen to land, that deferred `showTextDocument` can fire
 * after the next test has already shown a different file, stealing active
 * editor focus and failing assertions in a test that did nothing wrong.
 */
export async function waitForSourceEditor(doc: vscode.TextDocument) {
  await waitForCondition(
    () => vscode.window.activeTextEditor?.document.uri.toString() === doc.uri.toString(),
    {
      // the reopen normally lands in tens of milliseconds; stay inside the
      // 5s per-test mocha budget so this message is what surfaces on failure
      timeout: 2000,
      interval: 50,
      message: `${path.basename(doc.uri.fsPath)} to become the active text editor`
    }
  );
}

const YELLOW_COLOR_ESCAPE_CODE = '\x1b[33m';
const RESET_COLOR_ESCAPE_CODE = '\x1b[0m';

export async function readOrCreateSnapshot(fileName: string, content: string) {
  const snapshotUri = examplesUri(path.join('generated_snapshots', fileName));
  try {
    const doc = await vscode.workspace.openTextDocument(snapshotUri);
    return doc.getText();
  } catch {
    if (process.env['CI']) throw 'Attempted to create snapshot in CI!';

    console.warn(`${YELLOW_COLOR_ESCAPE_CODE}
⚠︎ Created snapshot in file:
${snapshotUri}
  Please take a look at the snapshot file and ensure it is what you expect
  If it looks good to you, please commit the generated snapshot along with your test code
  If you did not intend to create a snapshot, please carefully check your test code and delete the snapshot file
${RESET_COLOR_ESCAPE_CODE}`);

    await vscode.workspace.fs.writeFile(
      snapshotUri,
      Buffer.from(content, 'utf8') as Uint8Array
    );
    return content;
  }
}

/**
 * Emit a GitHub Actions warning annotation (surfaced on the PR and in the run
 * summary). Outside Actions it just prints a line, which is harmless.
 * See https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions
 */
export function emitActionsWarning(title: string, message: string): void {
  const data = message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  console.log(`::warning title=${title}::${data}`);
}

/**
 * Races a promise against a timeout, returning `undefined` if
 * the timeout is reached before the promise resolves.
 */
export async function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    timeoutPromise
  ]);
}
