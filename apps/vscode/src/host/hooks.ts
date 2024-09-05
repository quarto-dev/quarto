/*
 * hooks.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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

import * as vscode from 'vscode';
import * as hooks from 'positron';

import { ExtensionHost, HostWebviewPanel, HostStatementRangeProvider } from '.';
import { CellExecutor, cellExecutorForLanguage, executableLanguages, isKnitrDocument, pythonWithReticulate } from './executors';
import { MarkdownEngine } from '../markdown/engine';
import { virtualDoc, virtualDocUri, adjustedPosition } from "../vdoc/vdoc";
import { Disposable } from 'vscode';

declare global {
	function acquirePositronApi() : hooks.PositronApi;
}

let api : hooks.PositronApi | null | undefined;

export function hooksApi() : hooks.PositronApi | null {
  if (api === undefined) {
    try {
      api = acquirePositronApi();
    } catch {
      api = null;
    }
  }
  return api;
}

export function hasHooks() {
  return !!hooksApi();
}

type TaskId = number;
type TaskCallback = () => Promise<void>;

interface Task {
  id: TaskId,
  callback: TaskCallback
}

class TaskQueue implements Disposable {
  /// Singleton instance
  private static _instance: TaskQueue;

  private _id: TaskId = 0;
  private _tasks: Task[] = [];
  private _running = false;

  private readonly _onDidFinishTask = new vscode.EventEmitter<TaskId>();
  onDidFinishTask = this._onDidFinishTask.event;

  /**
   * Disposal method
   *
   * Not currently used since the singleton is effectively a global variable.
   */
  dispose(): void {
    this._onDidFinishTask.dispose();
  }

  /**
   * Constructor
   *
   * Private since we only want one of these. Access using `instance()` instead.
   */
  private constructor() { }

  /**
   * Accessor for the singleton instance
   *
   * Creates it if it doesn't exist.
   */
  static get instance(): TaskQueue {
    if (!TaskQueue._instance) {
      TaskQueue._instance = new TaskQueue();
    }
    return TaskQueue._instance;
  }

  /**
   * Construct a new `Task` that can be pushed onto the queue
   */
  task(callback: TaskCallback): Task {
    const id = this.id();
    return { id, callback }
  }

  /**
   * Retrives an `id` to be used with the next task
   */
  private id(): TaskId {
    let id = this._id;
    this._id++;
    return id;
  }

  /**
   * Pushes a `task` into the queue. Immediately runs it if nothing else is running.
   */
  async push(task: Task) {
    this._tasks.push(task);

    // Immediately run the task if possible
    this.run();
  }

  /**
   * Runs a task in the queue
   *
   * If we are currently running something else, bails. `run()` will be called again
   * once the other task finishes.
   */
  private async run() {
    if (this._running) {
      // Someone else is running, we will get recalled once they finish
      return;
    }

    const task = this._tasks.pop();

    if (task === undefined) {
      // Nothing to run right now
      return;
    }

    this._running = true;

    try {
      await task.callback();
    } finally {
      this._running = false;
      this._onDidFinishTask.fire(task.id);
    }

    // Run next task if one is in the queue
    this.run();
  }
}

export function hooksExtensionHost() : ExtensionHost {
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages)
    executableLanguages,

    cellExecutorForLanguage: async (language: string, document: vscode.TextDocument, engine: MarkdownEngine, silent?: boolean) 
      : Promise<CellExecutor | undefined> => {
      switch(language) {
        // use hooks for known runtimes
        case "python":
        case "r":
          return {
            execute: async (blocks: string[], _editorUri?: vscode.Uri) : Promise<void> => {
              const runtime = hooksApi()?.runtime;

              if (runtime === undefined) {
                // Can't do anything without a runtime
                return;
              }

              if (language === "python" && isKnitrDocument(document, engine)) {
                language = "r";
                blocks = blocks.map(pythonWithReticulate);
              }
              
              // Our callback executes each block sequentially
              const callback = async () => {
                for (const block of blocks) {
                  await runtime.executeCode(language, block, false);
                }
              }

              // Construct a new task that calls our `callback` when its our turn
              const task = TaskQueue.instance.task(callback);

              // Construct a promise that resolves when our task finishes
              const finished = new Promise<void>((resolve, _reject) => {
                const handle = TaskQueue.instance.onDidFinishTask((id) => {
                  if (task.id === id) {
                    handle.dispose();
                    resolve();
                  }
                });
              });

              // Push the task, which may immediately run it, and then wait for it to finish.
              // Using a task queue ensures that another call to `execute()` can't interleave
              // its own executions while we `await` between `blocks`.
              await TaskQueue.instance.push(task);
              await finished;
            },
            executeSelection: async () : Promise<void> => {
              await vscode.commands.executeCommand('workbench.action.positronConsole.executeCode', {languageId: language});
            } 
          };

        // delegate for other languages
        default:
          return cellExecutorForLanguage(language, document, engine, silent);
      }
    },

    registerStatementRangeProvider: (engine: MarkdownEngine): vscode.Disposable => {
      const hooks = hooksApi();
      if (hooks) {
        return hooks.languages.registerStatementRangeProvider('quarto', 
          new EmbeddedStatementRangeProvider(engine));
      }
      return new vscode.Disposable(() => {});
    },

    createPreviewPanel: (
      viewType: string, 
      title: string,
      preserveFocus?: boolean, 
      options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
    ): HostWebviewPanel => {

      // create preview panel
      const panel = hooksApi()?.window.createPreviewPanel(
        viewType,
        title,
        preserveFocus,
        {
          enableScripts: options?.enableScripts,
          enableForms: options?.enableForms,
          localResourceRoots: options?.localResourceRoots,
          portMapping: options?.portMapping
        }
      )!;
      
      // adapt to host interface
      return new HookWebviewPanel(panel);
    }
  };
}


class HookWebviewPanel implements HostWebviewPanel {
  constructor(private readonly panel_: hooks.PreviewPanel) {}

  get webview() { return this.panel_.webview; };
  get visible() { return this.panel_.visible; };
  reveal(_viewColumn?: vscode.ViewColumn, preserveFocus?: boolean) {
    this.panel_.reveal(preserveFocus);
  }
  onDidChangeViewState = this.panel_.onDidChangeViewState;
  onDidDispose = this.panel_.onDidDispose;
  dispose() { this.panel_.dispose(); };
}

class EmbeddedStatementRangeProvider implements HostStatementRangeProvider {
	private readonly _engine: MarkdownEngine;

	constructor(
		readonly engine: MarkdownEngine,
	) {
		this._engine = engine;
	}

  async provideStatementRange(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken): Promise<hooks.StatementRange | undefined> {
      const vdoc = await virtualDoc(document, position, this._engine);
      if (vdoc) {
        const vdocUri = await virtualDocUri(vdoc, document.uri, "statementRange");
        try {
          return getStatementRange(vdocUri.uri, adjustedPosition(vdoc.language, position));
        } catch (error) {
          return undefined;
        } finally {
          if (vdocUri.cleanup) {
            await vdocUri.cleanup();
          }
        }
      } else {
        return undefined;
      }
    };
}

async function getStatementRange(
  uri: vscode.Uri,
  position: vscode.Position,
) {
  return await vscode.commands.executeCommand<hooks.StatementRange>(
    "vscode.executeStatementRangeProvider",
    uri,
    position
  );
}
