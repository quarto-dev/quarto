/*
 * preview.ts
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

import * as path from "path";
import * as fs from "fs";
import * as uuid from "uuid";
import axios from "axios";

import vscode, {
  commands,
  env,
  ExtensionContext,
  MessageItem,
  Terminal,
  TerminalOptions,
  TextDocument,
  Selection,
  Range,
  Uri,
  ViewColumn,
  window,
  Position,
  TextEditorRevealType,
  NotebookDocument,
  ProgressLocation,
  CancellationToken,
} from "vscode";

import { normalizeNewlines, shQuote, winShEscape, pathWithForwardSlashes, sleep } from "core";
import { fileCrossrefIndexStorage, QuartoContext } from "quarto-core";

import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import {
  isNotebook,
  isQuartoDoc,
  preserveEditorFocus,
  QuartoEditor,
  validatateQuartoExtension,
} from "../../core/doc";
import { PreviewOutputSink } from "./preview-output";
import { isHtmlContent, isTextContent, isPdfContent } from "core-node";

import * as tmp from "tmp";
import {
  PreviewEnv,
  PreviewEnvManager,
  previewEnvsEqual,
  requiresTerminalDelay,
} from "./preview-env";
import { MarkdownEngine } from "../../markdown/engine";



import {
  QuartoPreviewWebview,
  QuartoPreviewWebviewManager,
} from "./preview-webview";
import {
  findEditor,
  haveNotebookSaveEvents,
  isQuartoShinyDoc,
  previewDirForDocument,
  renderOnSave,
} from "./preview-util";


import { vsCodeWebUrl } from "../../core/platform";

import {
  jupyterErrorLocation,
  knitrErrorLocation,
  luaErrorLocation,
  yamlErrorLocation,
} from "./preview-errors";

tmp.setGracefulCleanup();

const kPreviewWindowTitle = "Quarto Preview";

const kLocalPreviewRegex =
  /(http:\/\/(?:localhost|127\.0\.0\.1)\:\d+\/?[^\s]*)/;

let previewManager: PreviewManager;

export function activatePreview(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine
): Command[] {
  // create preview manager
  if (quartoContext.available) {
    previewManager = new PreviewManager(context, quartoContext, engine);
    context.subscriptions.push(previewManager);
  }

  // render on save
  const onSave = async (docUri: Uri) => {
    const editor = findEditor(
      (editorDoc) => editorDoc.uri.fsPath === docUri.fsPath
    );
    if (editor) {
      if (
        canPreviewDoc(editor.document) &&
        (await renderOnSave(engine, editor.document)) &&
        (await previewManager.isPreviewRunningForDoc(editor.document))
      ) {
        await previewDoc(editor, undefined, true, engine);
      }
    }
  };
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc: TextDocument) => {
      await onSave(doc.uri);
    })
  );
  // we use 1.66 as our minimum version (and type import) but
  // onDidSaveNotebookDocument was introduced in 1.67
  if (haveNotebookSaveEvents()) {
    context.subscriptions.push(
      (vscode.workspace as any).onDidSaveNotebookDocument(
        async (notebook: NotebookDocument) => {
          await onSave(notebook.uri);
        }
      )
    );
  }

  // preview commands
  return previewCommands(quartoContext, engine);
}

export function canPreviewDoc(doc?: TextDocument) {
  return !!doc && !!(isQuartoDoc(doc) || isNotebook(doc));
}

export function isPreviewRunning() {
  return previewManager.isPreviewRunning();
}

export function isPreviewRunningForDoc(doc: TextDocument) {
  return previewManager.isPreviewRunningForDoc(doc);
}

export async function previewDoc(
  editor: QuartoEditor,
  format: string | null | undefined,
  renderOnSave: boolean,
  engine?: MarkdownEngine,
  onShow?: () => void
) {
  // get the slide index if we can
  if (engine !== undefined) {
    // set the slide index from the source editor so we can
    // navigate to it in the preview frame
    if (!isNotebook(editor.document)) {
      previewManager.setSlideIndex(await editor.slideIndex(engine));
    } else {
      previewManager.setSlideIndex(undefined);
    }
  }
  //  set onShow if provided
  if (onShow !== undefined) {
    previewManager.setOnShow(onShow);
  }

  // activate the editor
  if (!isNotebook(editor.document)) {
    await editor.activate();
  }

  // if this wasn't a renderOnSave then save
  if (!renderOnSave) {
    await commands.executeCommand("workbench.action.files.save");
    if (editor.document.isDirty) {
      return;
    }
  }

  // execute the preview (rerefresh the reference after save)
  const previewEditor = findEditor(
    (editorDoc) => editorDoc.uri.fsPath === editor.document.uri.fsPath
  );
  if (previewEditor) {
    // error if we didn't save using a valid quarto extension
    if (!isNotebook(previewEditor.document) && !validatateQuartoExtension(previewEditor.document)) {
      window.showErrorMessage("Unsupported File Extension", {
        modal: true,
        detail:
          "This document cannot be rendered because it doesn't have a supported Quarto file extension. " +
          "Save the file with a .qmd extension then try rendering again.",
      });
      return;
    }

    // run the preview
    await previewManager.preview(previewEditor.document.uri, previewEditor.document, format);

    // focus the editor (sometimes the terminal steals focus)
    if (!isNotebook(previewEditor.document)) {
      await previewEditor.activate();
    }
  }
}

export async function previewProject(target: Uri, format?: string) {
  await previewManager.preview(target, undefined, format);
}

class PreviewManager {
  constructor(
    context: ExtensionContext,
    private readonly quartoContext_: QuartoContext,
    private readonly engine_: MarkdownEngine
  ) {
    this.renderToken_ = uuid.v4();
    this.webviewManager_ = new QuartoPreviewWebviewManager(
      context,
      "quarto.previewView",
      "Quarto Preview",
      QuartoPreviewWebview
    );
    this.outputSink_ = new PreviewOutputSink(
      this.onPreviewOutput.bind(this),
      this.onPreviewTick.bind(this)
    );
    this.previewEnvManager_ = new PreviewEnvManager(
      this.outputSink_,
      this.renderToken_
    );
  }

  dispose() {
    this.webviewManager_.dispose();
    this.outputSink_.dispose();
  }

  public async preview(
    uri: Uri,
    doc: TextDocument | undefined,
    format: string | null | undefined
  ) {
    // resolve format if we need to
    if (format === undefined) {
      format = this.previewFormats_.get(uri.fsPath) || null;
    } else {
      this.previewFormats_.set(uri.fsPath, format);
    }

    this.progressDismiss();
    this.progressCancellationToken_ = undefined;
    this.previewOutput_ = "";
    this.previewDoc_ = doc;
    const previewEnv = await this.previewEnvManager_.previewEnv(uri);
    if (doc && (await this.canReuseRunningPreview(doc, previewEnv))) {
      try {
        const response = await this.previewRenderRequest(doc, format);
        if (response.status === 200) {
          this.progressShow(uri);
        } else {
          await this.startPreview(previewEnv, uri, format, doc);
        }
      } catch (e) {
        await this.startPreview(previewEnv, uri, format, doc);
      }
    } else {
      await this.startPreview(previewEnv, uri, format, doc);
    }
  }

  public setSlideIndex(slideIndex?: number) {
    this.webviewManager_.setSlideIndex(slideIndex);
  }

  public setOnShow(f: () => void) {
    this.webviewManager_.setOnShow(f);
  }

  public async isPreviewRunning() {
    // no terminal means no preview server
    if (!this.terminal_ || this.terminal_.exitStatus !== undefined) {
      return false;
    }

    // no recorded preview server uri
    if (!this.previewCommandUrl_) {
      return false;
    }

    // look for any response from the server (it will give a 404 w/o logging for favicon)
    const pingRequestUri = this.previewServerRequestUri("/favicon.ico");
    try {
      const response = await axios.get(pingRequestUri, {
        timeout: 1000,
        validateStatus: () => true,
      });
      return response.status === 200 || response.status === 404;
    } catch (e) {
      return false;
    }
  }

  public async isPreviewRunningForDoc(doc: TextDocument) {
    return await this.isPreviewRunning() && (this.previewTarget_?.fsPath === doc.uri.fsPath);
  }

  private async canReuseRunningPreview(
    doc: TextDocument,
    previewEnv: PreviewEnv
  ) {
    return (
      !!this.previewUrl_ &&
      previewEnvsEqual(this.previewEnv_, previewEnv) &&
      this.previewType_ === this.previewTypeConfig() &&
      (this.previewType_ !== "internal" || this.webviewManager_.hasWebview()) &&
      !!this.terminal_ &&
      this.terminal_.exitStatus === undefined &&
      !(await isQuartoShinyDoc(this.engine_, doc))
    );
  }

  private previewRenderRequest(doc: TextDocument, format: string | null) {
    const requestUri = this.previewServerRequestUri("/" + this.renderToken_);

    const params: Record<string, unknown> = {
      path: doc.uri.fsPath,
    };
    if (format) {
      params.format = format;
    }
    return axios.get(requestUri, { params });
  }

  private async previewTerminateRequest() {
    const kTerminateToken = "4231F431-58D3-4320-9713-994558E4CC45";
    try {
      await axios.get(this.previewServerRequestUri("/" + kTerminateToken), {
        timeout: 1000,
      });
    } catch (error) {
      /*
      console.log("Error requesting preview server termination");
      console.log(error);
      */
    }
  }

  private previewServerRequestUri(path: string) {
    const previewUri = Uri.parse(this.previewCommandUrl_!);
    const requestUri = previewUri.scheme + "://" + previewUri.authority + path;
    return requestUri;
  }

  private async killPreview() {
    // dispose any existing preview terminals
    const terminal = window.terminals.find((terminal) => {
      return terminal.name === kPreviewWindowTitle;
    });
    if (terminal) {
      await this.previewTerminateRequest();
      terminal.dispose();
    }
    this.progressDismiss();
    this.progressCancellationToken_ = undefined;
  }

  private async startPreview(
    previewEnv: PreviewEnv,
    target: Uri,
    format: string | null,
    doc?: TextDocument
  ) {
    // dispose any existing preview terminals
    await this.killPreview();

    // cleanup output
    this.outputSink_.reset();

    // reset preview state
    this.previewEnv_ = previewEnv;
    this.previewTarget_ = target;
    this.previewType_ = this.previewTypeConfig();
    this.previewUrl_ = undefined;
    this.previewDir_ = undefined;
    this.previewCommandUrl_ = undefined;
    this.previewOutputFile_ = undefined;

    // determine preview dir (if any)
    const isFile = fs.statSync(target.fsPath).isFile();
    this.previewDir_ = isFile ? previewDirForDocument(target) : undefined;

    // calculate cwd
    const cwd = this.previewDir_ || this.targetDir();

    // create and show the terminal
    const options: TerminalOptions = {
      name: kPreviewWindowTitle,
      cwd,
      env: this.previewEnv_ as unknown as {
        [key: string]: string | null | undefined;
      },
    };

    // add crossref index path to env (will be ignored if we are in a project)
    if (isFile) {
      options.env!["QUARTO_CROSSREF_INDEX_PATH"] = fileCrossrefIndexStorage(
        target.fsPath
      );
    }

    // is this is a shiny doc?
    const isShiny = await isQuartoShinyDoc(this.engine_, doc);

    // clear if a shiny doc
    if (isShiny && this.webviewManager_) {
      this.webviewManager_.clear();
    }

    this.terminal_ = window.createTerminal(options);
    const quarto = "quarto"; // binPath prepended to PATH so we don't need the full form
    const cmd: string[] = [
      this.quartoContext_.useCmd ? winShEscape(quarto) : shQuote(quarto),
      isShiny ? "serve" : "preview",
      shQuote(
        this.quartoContext_.useCmd
          ? target.fsPath
          : pathWithForwardSlashes(target.fsPath)
      ),
    ];

    // extra args for normal docs
    if (!isShiny) {
      if (!doc) {
        // project render
        cmd.push("--render", format || "all");
      } else if (format) {
        // doc render
        cmd.push("--to", format);
      }

      cmd.push("--no-browser");
      cmd.push("--no-watch-inputs");
    }

    const cmdText = this.quartoContext_.useCmd
      ? `cmd /C"${cmd.join(" ")}"`
      : cmd.join(" "); 
    this.terminal_.show(true);
    // delay if required (e.g. to allow conda to initialized)
    // wait for up to 5 seconds (note that we can do this without
    // risk of undue delay b/c the state.isInteractedWith bit will
    // flip as soon as the environment has been activated)
    if (requiresTerminalDelay(this.previewEnv_)) {
      const kMaxSleep = 5000;
      const kInterval = 100;
      let totalSleep = 0;
      while (!this.terminal_.state.isInteractedWith && totalSleep < kMaxSleep) {
        await sleep(kInterval);
        totalSleep += kInterval;
      }
    }

    // send the command
    console.info("[quarto]: " + cmdText + "\n");
    this.terminal_!.sendText(cmdText, true);

    // show progress
    this.progressShow(target);
  }

  private async onPreviewTick() {
    if (this.progressCancelled()) {
      await this.killPreview();
    }
  }

  private async onPreviewOutput(output: string) {
    this.detectErrorNavigation(output);
    const kOutputCreatedPattern = /Output created\: (.*?)\n/;
    this.previewOutput_ += output;
    if (!this.previewUrl_) {
      // detect new preview and show in browser
      const match = this.previewOutput_.match(kLocalPreviewRegex);
      if (match) {
        // dismiss progress
        this.progressDismiss();

        // capture output file
        const fileMatch = this.previewOutput_.match(kOutputCreatedPattern);
        if (fileMatch) {
          this.previewOutputFile_ = this.outputFileUri(fileMatch[1]);
        }

        // capture preview command url and preview url
        this.previewCommandUrl_ = match[1];
        const browseMatch = this.previewOutput_.match(
          /(Browse at|Listening on) (https?:\/\/[^\s]*)/
        );
        if (browseMatch) {
          // shiny document
          if (await isQuartoShinyDoc(this.engine_, this.previewDoc_)) {
            this.previewUrl_ = vsCodeWebUrl(browseMatch[2]);
          } else {
            this.previewUrl_ = browseMatch[2];
          }
        } else {
          this.previewUrl_ = this.previewCommandUrl_;
        }

        // if there was a 'preview service running' message then that
        // also establishes an alternate control channel
        const previewServiceMatch = this.previewOutput_.match(
          /Preview service running \((\d+)\)/
        );
        if (previewServiceMatch) {
          this.previewCommandUrl_ = `http://127.0.0.1:${previewServiceMatch[1]}`;
        }

        if (this.previewType_ === "internal") {
          await this.showPreview();
        } else if (this.previewType_ === "external") {
          try {
            const url = Uri.parse(this.previewUrl_);
            env.openExternal(url);
          } catch {
            // Noop
          }
        }
      }
    } else {
      // detect update to existing preview and activate browser
      if (this.previewOutput_.match(kOutputCreatedPattern)) {
        this.progressDismiss();
        if (this.previewType_ === "internal" && this.previewRevealConfig()) {
          this.updatePreview();
        }
      }
    }
  }

  private progressShow(uri: Uri) {
    window.withProgress(
      {
        title: `Rendering ${path.basename(uri.fsPath)}`,
        cancellable: true,
        location: ProgressLocation.Window,
      },
      (_progress, token) => {
        this.progressCancellationToken_ = token;
        return new Promise((resolve) => {
          this.progressDismiss_ = resolve;
        });
      }
    );
  }

  private progressDismiss() {
    if (this.progressDismiss_) {
      this.progressDismiss_();
      this.progressDismiss_ = undefined;
    }
  }

  private progressCancelled() {
    return !!this.progressCancellationToken_?.isCancellationRequested;
  }

  private async detectErrorNavigation(output: string) {
    // bail if this is a notebook or we don't have a previewDoc
    if (!this.previewDoc_ || isNotebook(this.previewDoc_)) {
      return;
    }

    // normalize
    output = normalizeNewlines(output);

    // run all of our tests
    const previewFile = this.previewDoc_.uri.fsPath;
    const previewDir = this.previewDir_ || this.targetDir();
    const errorLoc =
      yamlErrorLocation(output, previewFile, previewDir) ||
      jupyterErrorLocation(output, previewFile, previewDir) ||
      knitrErrorLocation(output, previewFile, previewDir) ||
      luaErrorLocation(output, previewFile, previewDir);
    if (errorLoc && fs.existsSync(errorLoc.file)) {
      // dismiss progress
      this.progressDismiss();

      // ensure terminal is visible
      this.terminal_!.show(true);

      // find existing visible instance
      const fileUri = Uri.file(errorLoc.file);
      const editor = findEditor((doc) => doc.uri.fsPath === fileUri.fsPath);
      if (editor) {
        if (editor.textEditor) {
          // if the current selection is outside of the error region then
          // navigate to the top of the error region
          const errPos = new Position(errorLoc.lineBegin - 1, 0);
          const errEndPos = new Position(errorLoc.lineEnd - 1, 0);
          const textEditor = editor.textEditor;
          if (
            textEditor.selection.active.isBefore(errPos) ||
            textEditor.selection.active.isAfter(errEndPos)
          ) {
            textEditor.selection = new Selection(errPos, errPos);
            textEditor.revealRange(
              new Range(errPos, errPos),
              TextEditorRevealType.InCenterIfOutsideViewport
            );
          }
        }
        preserveEditorFocus(editor);
      }
    }
  }

  private async showPreview() {
    if (
      !this.previewOutputFile_ || // no output file means project render/preview
      this.isBrowserPreviewable(this.previewOutputFile_)
    ) {
      // https://code.visualstudio.com/api/advanced-topics/remote-extensions
      const previewUrl = (await vscode.env.asExternalUri(Uri.parse(this.previewUrl_!))).toString();
      this.webviewManager_.showWebview(previewUrl, {
        preserveFocus: true,
        viewColumn: ViewColumn.Beside,
      });
      this.webviewManager_.setOnError(this.progressDismiss.bind(this));
    } else {
      this.showOuputFile();
    }
  }

  private updatePreview() {
    if (this.isBrowserPreviewable(this.previewOutputFile_)) {
      this.webviewManager_.revealWebview();
    } else {
      this.showOuputFile();
    }
  }

  private targetDir() {
    const targetPath = this.previewTarget_!.fsPath;
    if (fs.statSync(targetPath).isDirectory()) {
      return targetPath;
    } else {
      return path.dirname(targetPath);
    }
  }

  private outputFileUri(file: string) {
    if (path.isAbsolute(file)) {
      return Uri.file(file);
    } else {
      return Uri.file(path.join(this.targetDir()!, file));
    }
  }

  private isBrowserPreviewable(uri?: Uri) {
    return (
      isHtmlContent(uri?.toString()) ||
      isPdfContent(uri?.toString()) ||
      isTextContent(uri?.toString())
    );
  }

  private previewTypeConfig(): "internal" | "external" | "none" {
    return this.quartoConfig().get("render.previewType", "internal");
  }

  private previewRevealConfig(): boolean {
    return this.quartoConfig().get("render.previewReveal", true);
  }

  private quartoConfig() {
    return vscode.workspace.getConfiguration("quarto");
  }

  private async showOuputFile() {
    if (this.previewOutputFile_) {
      const outputFile = this.previewOutputFile_.fsPath;
      const viewFile: MessageItem = { title: "View Preview" };
      const result = await window.showInformationMessage<MessageItem>(
        "Render complete for " + path.basename(outputFile),
        viewFile
      );
      if (result === viewFile) {
        // open non localhost urls externally
        if (this.previewUrl_ && !this.previewUrl_.match(kLocalPreviewRegex)) {
          vscode.env.openExternal(Uri.parse(this.previewUrl_!));
        } else {
          const outputTempDir = tmp.dirSync();
          const outputTemp = path.join(
            outputTempDir.name,
            path.basename(outputFile)
          );
          fs.copyFileSync(outputFile, outputTemp);
          fs.chmodSync(outputTemp, fs.constants.S_IRUSR);
          vscode.env.openExternal(Uri.file(outputTemp));
        }
      }
    }
  }

  private previewOutput_ = "";
  private previewDoc_: TextDocument | undefined;
  private previewEnv_: PreviewEnv | undefined;
  private previewTarget_: Uri | undefined;
  private previewUrl_: string | undefined;
  private previewDir_: string | undefined;
  private previewCommandUrl_: string | undefined;
  private previewOutputFile_: Uri | undefined;
  private previewType_: "internal" | "external" | "none" | undefined;

  private terminal_: Terminal | undefined;

  // progress management
  private progressDismiss_: ((value?: unknown) => void) | undefined;
  private progressCancellationToken_: CancellationToken | undefined;

  private readonly renderToken_: string;
  private readonly previewEnvManager_: PreviewEnvManager;
  private readonly webviewManager_: QuartoPreviewWebviewManager;
  private readonly outputSink_: PreviewOutputSink;
  private readonly previewFormats_ = new Map<string, string | null>();
}
