/*
 * commands.ts
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

import semver from "semver";
import * as path from "path";
import * as fs from "fs";

import { TextDocument, window, Uri, workspace, commands } from "vscode";
import { projectDirForDocument, QuartoContext, quartoProjectConfig } from "quarto-core";

import { Command } from "../../core/command";
import {
  canPreviewDoc,
  isPreviewRunningForDoc,
  previewDoc,
  previewProject,
} from "./preview";
import { MarkdownEngine } from "../../markdown/engine";
import { findQuartoEditor, isNotebook } from "../../core/doc";
import { promptForQuartoInstallation } from "../../core/quarto";
import { renderOnSave } from "./preview-util";

export function previewCommands(
  quartoContext: QuartoContext,
  engine: MarkdownEngine
): Command[] {
  return [
    new RenderDocumentCommand(quartoContext, engine),
    new RenderShortcutCommand(quartoContext, engine),
    new RenderDocumentHTMLCommand(quartoContext, engine),
    new RenderDocumentPDFCommand(quartoContext, engine),
    new RenderDocumentDOCXCommand(quartoContext, engine),
    new RenderProjectCommand(quartoContext, engine),
    new WalkthroughRenderCommand(quartoContext, engine),
    new ClearCacheCommand(engine),
  ];
}

abstract class RenderCommand {
  constructor(quartoContext: QuartoContext) {
    this.quartoContext_ = quartoContext;
  }
  async execute() {
    if (this.quartoContext_.available) {
      const kRequiredVersion = "0.9.149";
      if (semver.gte(this.quartoContext_.version, kRequiredVersion)) {
        await this.doExecute();
      } else {
        window.showWarningMessage(
          `Rendering requires Quarto version ${kRequiredVersion} or greater`,
          { modal: true }
        );
      }
    } else {
      await promptForQuartoInstallation("rendering documents");
    }
  }
  protected abstract doExecute(): Promise<void>;
  private readonly quartoContext_: QuartoContext;
}

abstract class RenderDocumentCommandBase extends RenderCommand {
  constructor(
    quartoContext: QuartoContext,
    private readonly engine_: MarkdownEngine
  ) {
    super(quartoContext);
  }
  protected async renderFormat(format?: string | null, onShow?: () => void) {
    const targetEditor = findQuartoEditor(this.engine_, canPreviewDoc);
    if (targetEditor) {
      const render =
        !(await renderOnSave(this.engine_, targetEditor.document)) ||
        !(await isPreviewRunningForDoc(targetEditor.document));
      if (render) {
        await previewDoc(targetEditor, format, false, this.engine_, onShow);
      } else {
        // show the editor
        if (!isNotebook(targetEditor.document)) {
          await targetEditor.activate();
        }

        // save (will trigger render b/c renderOnSave is enabled)
        await commands.executeCommand("workbench.action.files.save");
      }
    } else {
      window.showInformationMessage("No Quarto document available to render");
    }
  }
}

class RenderShortcutCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderShortcut";
  public readonly id = RenderShortcutCommand.id;

  protected async doExecute() {
    return super.renderFormat();
  }
}

class RenderDocumentCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.render";
  public readonly id = RenderDocumentCommand.id;

  protected async doExecute() {
    return super.renderFormat(null);
  }
}

class RenderDocumentHTMLCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderHTML";
  public readonly id = RenderDocumentHTMLCommand.id;

  protected async doExecute() {
    return super.renderFormat("html");
  }
}

class RenderDocumentPDFCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderPDF";
  public readonly id = RenderDocumentPDFCommand.id;

  protected async doExecute() {
    return super.renderFormat("pdf");
  }
}

class RenderDocumentDOCXCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderDOCX";
  public readonly id = RenderDocumentDOCXCommand.id;

  protected async doExecute() {
    return super.renderFormat("docx");
  }
}

class RenderProjectCommand extends RenderCommand implements Command {
  private static readonly id = "quarto.renderProject";
  public readonly id = RenderProjectCommand.id;

  constructor(private readonly quartoContext: QuartoContext,
              private readonly engine_: MarkdownEngine) {
    super(quartoContext);
  }

  async doExecute() {
    await workspace.saveAll(false);
    // start by using the currently active or visible source files
    const targetEditor = findQuartoEditor(this.engine_, canPreviewDoc);
    if (targetEditor) {
      const projectDir = projectDirForDocument(targetEditor.document.uri.fsPath);
      if (projectDir) {
        previewProject(Uri.file(projectDir));
        return;
      }
    }

    // next check any open workspaces for a project file
    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        const config = await quartoProjectConfig(this.quartoContext.runQuarto, folder.uri.fsPath);
        if (config) {
          previewProject(folder.uri);
          return;
        }
      }
    }

    // no project found!
    window.showInformationMessage("No project available to render.");
  }
}

class ClearCacheCommand implements Command {
  private static readonly id = "quarto.clearCache";
  public readonly id = ClearCacheCommand.id;

  constructor(private readonly engine_: MarkdownEngine) {}

  async execute(): Promise<void> {
    // see if there is a cache to clear
    const doc = findQuartoEditor(this.engine_, canPreviewDoc)?.document;
    if (doc) {
      const cacheDir = cacheDirForDocument(doc);
      if (cacheDir) {
        const result = await window.showInformationMessage(
          "Clear Cache Directory",
          { modal: true, detail: `Delete the cache directory at ${cacheDir}?` },
          "Yes",
          "No"
        );
        if (result === "Yes") {
          await workspace.fs.delete(Uri.file(cacheDir), { recursive: true });
        }
      } else {
        window.showInformationMessage("Unable to Clear Cache", {
          modal: true,
          detail:
            "There is no cache associated with the current Quarto document.",
        });
      }
      // see if there is an _cache directory for this file
      // see if there is a .jupyter_cache directory for this file
    } else {
      window.showInformationMessage("Unable to Clear Cache", {
        modal: true,
        detail: "The current document is not a Quarto document.",
      });
    }
  }
}

class WalkthroughRenderCommand extends RenderDocumentCommandBase {
  private static readonly id = "quarto.walkthrough.render";
  public readonly id = WalkthroughRenderCommand.id;

  protected async doExecute() {
    return super.renderFormat(null, () => {
      commands.executeCommand("workbench.action.closeSidebar");
    });
  }
}

function cacheDirForDocument(doc: TextDocument) {
  // directory for doc
  const dir = path.dirname(doc.fileName);

  // check for jupyter cache
  const jupyterCacheDir = path.join(dir, ".jupyter_cache");
  if (fs.existsSync(jupyterCacheDir)) {
    return jupyterCacheDir;
  }

  // check for knitr cache
  const stem = path.basename(doc.fileName, path.extname(doc.fileName));
  const knitrCacheDir = path.join(dir, stem + "_cache");
  if (fs.existsSync(knitrCacheDir)) {
    return knitrCacheDir;
  }

  return undefined;
}
