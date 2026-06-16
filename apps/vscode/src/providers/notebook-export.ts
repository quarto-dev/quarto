/*
 * notebook-export.ts
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

import { QuartoContext } from "quarto-core";
import { LogOutputChannel } from "vscode";
import { extensions } from "vscode";
import { NotebookExporter, NotebookExportExtension } from "../@types/positron-notebook-export";
import { promptForQuartoInstallation } from "../core/quarto";
import { convertDocument } from "./convert";
import { Extension } from "vscode";
import { NotebookDocument } from "vscode";
import { ContextKey } from "../core/context";
import { Disposable, DisposableStore } from "core";
import { Disposable as VscodeDisposable } from "vscode";

/**
 * ID of the Positron Notebook Export extension, which provides an API for exporting notebooks to other formats.
 */
const notebookExportExtensionId = 'positron.notebook-export';

/**
 * Context key that is true when the Quarto notebook exporter is registered.
 */
const hasNotebookExporterKey = 'quarto.hasNotebookExporter';

/**
 * Label for the Quarto notebook exporter, exported for tests.
 */
export const notebookExporterLabel = 'Quarto Markdown';

/**
 * Activate the notebook export feature.
 * @returns The notebook export service, or `undefined` if it it could not be activated.
 */
export function activateNotebookExport(
  quartoContext: QuartoContext,
  outputChannel: LogOutputChannel
): NotebookExportService | undefined {
  const exportExt = getNotebookExportExtension();
  if (!exportExt) {
    outputChannel.debug(
      `No ${notebookExportExtensionId} extension, ` +
      'not activating notebook export'
    );
    return undefined;
  }

  const notebookExportService = new NotebookExportService(exportExt, quartoContext, outputChannel);
  return notebookExportService;
}

/**
 * Get the Positron Notebook Export extension, if it is available.
 */
export function getNotebookExportExtension(): Extension<NotebookExportExtension> | undefined {
  return extensions.getExtension<NotebookExportExtension>(notebookExportExtensionId);
}

export class NotebookExportService extends Disposable {
  _activatePromise: Thenable<void>;

  private readonly _hasNotebookExporter = new ContextKey(hasNotebookExporterKey);

  constructor(
    exportExt: Extension<NotebookExportExtension>,
    private readonly _quartoContext: QuartoContext,
    private readonly _outputChannel: LogOutputChannel,
  ) {
    super();

    this._outputChannel.debug('Activating notebook export...');
    this._activatePromise = exportExt.activate().then((exportApi) => {
      this._register(this._registerNotebookExporter(exportApi));
      this._outputChannel.debug('Activated notebook export!');
    }, (err) => {
      this._outputChannel.error(`Failed to activate ${notebookExportExtensionId} extension: ${err}`);
    }).then(undefined, (err) => {
      this._outputChannel.error(`Failed to activate notebook exporter: ${err}`);
    });
  }

  /** Awaitable cleanup for use during extension deactivation. */
  async deactivate(): Promise<void> {
    try {
      await this._activatePromise;
    } catch {
      // Ignore activation errors, they're handled elsewhere.
    }
  }

  private _registerNotebookExporter(exportApi: NotebookExportExtension): VscodeDisposable {
    const disposables = new DisposableStore();

    // Unregister the exporter when this feature is disposed.
    disposables.add(
      exportApi.registerNotebookExporter(
        new QuartoNotebookExporter(this._quartoContext, this._outputChannel)
      )
    );

    // Enable the context key used to disable convert commands;
    // exporters are preferred when available.
    this._hasNotebookExporter.set(true)
      .catch(err => this._outputChannel.error(
        `Failed to set context key ${this._hasNotebookExporter.name}: ${err}`
      ));

    // Reset the context key when this feature is disposed.
    disposables.add({
      dispose: () => this._hasNotebookExporter.reset()
        // Log at debug, since this should be harmless.
        .catch(err => this._outputChannel.debug(
          `Failed to reset context key ${this._hasNotebookExporter.name}: ${err}`
        ))
    });

    return disposables;
  }
}

class QuartoNotebookExporter implements NotebookExporter {
  label = notebookExporterLabel;
  fileExtension = '.qmd';

  constructor(
    private readonly quartoContext: QuartoContext,
    private readonly outputChannel: LogOutputChannel
  ) { }

  async export(notebook: NotebookDocument): Promise<void> {
    if (!this.quartoContext.available) {
      // Ensure that Quarto is installed.
      // `quarto convert` was available from the pre-release, no need to check min version.
      await promptForQuartoInstallation("before exporting notebooks", true);
      return;
    }

    await convertDocument(
      this.quartoContext,
      this.outputChannel,
      notebook.uri,
      ".qmd"
    );
  }
}
