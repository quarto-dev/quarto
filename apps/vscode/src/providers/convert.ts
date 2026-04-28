/*
 * convert.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { commands, LogOutputChannel, Uri, window } from "vscode";
import { QuartoContext } from "quarto-core";

import { Command } from "../core/command";
import { canPreviewDoc, findQuartoEditor } from "../core/doc";
import { promptForQuartoInstallation } from "../core/quarto";
import { MarkdownEngine } from "../markdown/engine";

export function activateConvert(
  quartoContext: QuartoContext,
  engine: MarkdownEngine,
  outputChannel: LogOutputChannel
): Command[] {
  return [
    new ConvertToIpynbCommand(quartoContext, engine, outputChannel),
    new ConvertToQmdCommand(quartoContext, engine, outputChannel),
  ];
}

/**
 * Convert a document using `quarto convert`.
 *
 * @param quartoContext Quarto context for running the CLI command
 * @param outputChannel Output channel for logging errors
 * @param sourceUri URI of the document to convert
 * @param targetExt Target extension for the converted file (e.g. ".ipynb", ".qmd")
 * @returns URI of the converted file if successful, otherwise `undefined`
 */
async function convertDocument(
  quartoContext: QuartoContext,
  outputChannel: LogOutputChannel,
  sourceUri: Uri,
  targetExt: string
): Promise<void> {
  // Warn and exit early for unsaved files.
  if (sourceUri.scheme !== "file") {
    window.showWarningMessage("Save the file to disk before converting.");
    return;
  }

  // Ensure the on-disk file is up-to-date before calling the CLI.
  await commands.executeCommand("workbench.action.files.save");

  // The CLI would silently overwrite any existing file.
  // First get the user's permission.
  const fsPath = sourceUri.fsPath;
  const outputPath = fsPath.slice(0, -path.extname(fsPath).length) + targetExt;
  if (fs.existsSync(outputPath)) {
    const overwrite = "Overwrite";
    const result = await window.showWarningMessage(
      `${path.basename(outputPath)} already exists. Overwrite?`,
      { modal: true },
      overwrite
    );
    if (result !== overwrite) {
      return;
    }
  }

  try {
    quartoContext.runQuarto(
      // Pipe so CLI output doesn't leak into the developer console,
      // we capture output/errors ourselves.
      { stdio: "pipe" },
      "convert",
      fsPath,
      // Always pass an explicit output path, using the same heuristic as the CLI.
      // This lets us first verify if the output file exists to avoid silently
      // overwriting it.
      "--output",
      outputPath
    );
  } catch (e: unknown) {
    if (!(e instanceof Error)) {
      // Unknown error, throw as-is
      throw e;
    }

    // execFileSync attaches stderr to the error. Prefer it over the generic
    // Node "Command failed" wrapper since the CLI messages are more useful.
    const stderr = "stderr" in e ? String(e.stderr).trim() : undefined;

    // Log the error.
    outputChannel.error(`quarto convert failed for ${path.basename(fsPath)}`);
    if (stderr) {
      outputChannel.error(stderr);
    }
    outputChannel.error(e.stack || e.message);

    // Strip Deno stack frames (lines starting with whitespace + "at ")
    // that appear on uncaught exceptions — not useful in a UI dialog.
    const message = stderr
      ? stderr.replace(/^\s+at .+$/gm, "").trim()
      : e.message;

    // Show the error message.
    const showOutput = "Show Output";
    const action = await window.showWarningMessage(
      `Quarto convert failed: ${message}`,
      showOutput
    );
    if (action === showOutput) {
      outputChannel.show();
    }
    return;
  }

  // Open the converted file in the default editor for its type
  // (e.g. notebook editor for .ipynb, text editor for .qmd).
  await commands.executeCommand("vscode.open", Uri.file(outputPath));
}

class ConvertToIpynbCommand implements Command {
  public readonly id = "quarto.convertToIpynb";

  constructor(
    private readonly quartoContext_: QuartoContext,
    private readonly engine_: MarkdownEngine,
    private readonly outputChannel_: LogOutputChannel
  ) { }

  async execute(): Promise<void> {
    if (!this.quartoContext_.available) {
      // Ensure that Quarto is installed.
      // `quarto convert` was available from the pre-release, no need to check min version.
      await promptForQuartoInstallation("before converting documents", true);
      return;
    }

    const sourceUri = this._getSourceUri();
    if (!sourceUri) {
      // Couldn't find a valid source document to convert
      return;
    }

    await convertDocument(
      this.quartoContext_,
      this.outputChannel_,
      sourceUri,
      ".ipynb"
    );
  }

  private _getSourceUri(): Uri | undefined {
    const editor = findQuartoEditor(
      this.engine_,
      this.quartoContext_,
      // Quarto can convert all previewable markdown types (qmd, md, Rmd)
      canPreviewDoc,
    );
    if (editor) {
      return editor.document.uri;
    }

    // No active Quarto editor
    return undefined;
  }
}

class ConvertToQmdCommand implements Command {
  public readonly id = "quarto.convertToQmd";

  constructor(
    private readonly quartoContext_: QuartoContext,
    private readonly engine_: MarkdownEngine,
    private readonly outputChannel_: LogOutputChannel
  ) { }

  async execute(): Promise<void> {
    if (!this.quartoContext_.available) {
      // Ensure that Quarto is installed.
      // `quarto convert` was available from the pre-release, no need to check min version.
      await promptForQuartoInstallation("before converting documents", true);
      return;
    }

    const sourceUri = this._getSourceUri();
    if (!sourceUri) {
      // Couldn't find a valid source document to convert
      return;
    }

    await convertDocument(
      this.quartoContext_,
      this.outputChannel_,
      sourceUri,
      ".qmd"
    );
  }

  private _getSourceUri(): Uri | undefined {
    // Get the source notebook that this command was invoked from.
    const notebookEditor = window.activeNotebookEditor;
    if (notebookEditor) {
      const notebookUri = notebookEditor.notebook.uri;
      // Can only convert from .ipynb
      if (notebookUri.fsPath.endsWith(".ipynb")) {
        return notebookUri;
      }
    }

    // Edge case: fall back to text editors
    const quartoEditor = findQuartoEditor(
      this.engine_,
      this.quartoContext_,
      // Can only convert from .ipynb
      (doc) => doc.uri.fsPath.endsWith(".ipynb")
    );
    if (quartoEditor) {
      return quartoEditor.document.uri;
    }

    // No active editor
    return undefined;
  }
}
