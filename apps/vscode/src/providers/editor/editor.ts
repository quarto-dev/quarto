/*
 * editor.ts
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

import path, { extname } from "path";

import { 
  window,
  workspace, 
  ExtensionContext, 
  Disposable, 
  CustomTextEditorProvider, 
  TextDocument, 
  WebviewPanel, 
  CancellationToken, 
  Uri, 
  Webview,
  env,
  commands,
  ViewColumn
} from "vscode";

import { LanguageClient } from "vscode-languageclient/node";

import { projectDirForDocument, QuartoContext } from "quarto-core";

import { HostContext, VSCodeVisualEditor, VSCodeVisualEditorHost, XRef } from "editor-types";

import { getNonce } from "../../core/nonce";
import { isWindows } from "../../core/platform";
import { isQuartoDoc, kQuartoLanguageId, preserveEditorFocus, QuartoEditor } from "../../core/doc";

import { visualEditorClient, visualEditorServer } from "./connection";
import { editorSyncManager } from "./sync";
import { documentImageResolver } from "./images";

export function activateEditor(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  lspClient: LanguageClient
) {
  context.subscriptions.push(VisualEditorProvider.register(context, quartoContext, lspClient));
}

export class VisualEditorProvider implements CustomTextEditorProvider {
  
  // track the last contents of any active untitled docs (used
  // for recovering from attempt to edit )
  private static activeUntitled?: { uri: Uri, content: string };

  // track visual editors
  private static visualEditors = visualEditorTracker();

  public static register(
    context: ExtensionContext, 
    quartoContext: QuartoContext,
    lspClient: LanguageClient
  ) : Disposable {

    // track edits in the active editor if its untitled. this enables us to recover the
    // content when we switch to an untitled document, which otherwise are just dropped
    // on the floor by vscode 
    context.subscriptions.push(workspace.onDidChangeTextDocument(e => {
      const doc = window.activeTextEditor?.document;
      if (doc && isQuartoDoc(doc) && doc.isUntitled && (doc.uri.toString() === e.document.uri.toString())) {
        this.activeUntitled = { uri: doc.uri, content: doc.getText() };
      } else {
        this.activeUntitled = undefined;
      }
    }));

    const provider = new VisualEditorProvider(context, quartoContext, lspClient);
    const providerRegistration = window.registerCustomEditorProvider(
      VisualEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        }
      }
    );
    return providerRegistration;
  }

  public static readonly viewType = "quarto.visualEditor";

  public static activeEditor(includeVisible?: boolean) : QuartoEditor | undefined {
    const editor = this.visualEditors.activeEditor(includeVisible);
    if (editor) {
      return { 
        document: editor.document, 
        activate: async () => {
          editor.webviewPanel.reveal(editor.webviewPanel.viewColumn, false);
          // delay required to circumvent other focus activity
          setTimeout(() => {
            editor.editor.focus();
          }, 200);
        },
        viewColumn: editor.webviewPanel.viewColumn 
      };
    } else {
      return undefined;
    }
  }

  constructor(private readonly context: ExtensionContext,
              private readonly quartoContext: QuartoContext,
              private readonly lspClient: LanguageClient) {}

 
  public resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    _token: CancellationToken
  ) {

    // if the document is untitled then capture its contents (as vscode throws it on the floor
    // and we may need it to do a re-open)
    const untitledContent = 
      (document.isUntitled && 
      VisualEditorProvider.activeUntitled?.uri.toString() === document.uri.toString())
        ? VisualEditorProvider.activeUntitled.content
        : undefined;
    
    const projectDir = document.isUntitled ? undefined : projectDirForDocument(document.fileName);
    const workspaceDir = this.quartoContext.workspaceDir;

    // track disposables
    const disposables: Disposable[] = [];

    // get visual editor client
    const client = visualEditorClient(webviewPanel);
    disposables.push(client);

    // sync manager
    const syncManager = editorSyncManager(document, client.editor);

    // editor container implementation   
    const host: VSCodeVisualEditorHost = {

      // editor is querying for context
      getHostContext: async () : Promise<HostContext> => {
        return {
          documentPath: document.isUntitled ? null : document.fileName,
          projectDir,
          resourceDir: document.isUntitled 
            ? (projectDir || workspaceDir || process.cwd()) 
            : path.dirname(document.fileName),
          isWindowsDesktop: isWindows()
        };
      },

      reopenSourceMode: async () => {

        // save if required
        if (!document.isUntitled) {
          await commands.executeCommand("workbench.action.files.save");
        }

        // close editor (return immediately as if we don't then this 
        // rpc method's return will result in an error b/c the webview
        // has been torn down by the time we return)
        const viewColumn = webviewPanel.viewColumn;
        commands.executeCommand('workbench.action.closeActiveEditor').then(async () => {
          if (document.isUntitled) {
            const doc = await workspace.openTextDocument({
              language: kQuartoLanguageId,
              content: untitledContent || '',
            });
            await window.showTextDocument(doc, viewColumn, false);
          } else {
            const doc = await workspace.openTextDocument(document.uri);
            await window.showTextDocument(doc, viewColumn, false);
          }
        });
      },

      // editor is fully loaded and ready for communication
      onEditorReady: async () => {

        // initialize sync manager
        await syncManager.init();

        // notify for document changes
        disposables.push(workspace.onDidChangeTextDocument(
          async (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
              await syncManager.onDocumentChanged();
            }
          }
        ));

        // notify for saves (ensure we get latest changes applied)
        disposables.push(workspace.onWillSaveTextDocument(
          (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
              e.waitUntil(syncManager.onDocumentSaving());
            }
          }
        ));

        // last ditch notification for saves (in case we didn't get our changes applied)
        disposables.push(workspace.onDidSaveTextDocument(
          (doc) => {
            if (doc.uri.toString() === document.uri.toString()) {
              syncManager.onDocumentSaved();
            }
          }
        ));
      },

      // notify sync manager when visual editor is updated
      onEditorUpdated: syncManager.onVisualEditorChanged,

      // flush any pending updates
      flushEditorUpdates: syncManager.flushPendingUpdates,

      // map resources to uris valid in the editor
      editorResourceUri: async (path: string) => {
        const uri = webviewPanel.webview.asWebviewUri(Uri.parse(path)).toString();
        return uri;
      },

      openURL: function (url: string): void {
        env.openExternal(Uri.parse(url));
      },
      navigateToXRef: function (file: string, xref: XRef): void {
        navigateToFile(document, file, xref);
      },
      navigateToFile: function (file: string): void {
        navigateToFile(document, file);
      },

      ...documentImageResolver(document, projectDir)
    };

    // setup server on webview iframe
    disposables.push(visualEditorServer(webviewPanel, this.lspClient, host));

    // load editor webview (include current doc path in localResourceRoots)
    webviewPanel.webview.options = { 
      localResourceRoots: [
        this.context.extensionUri,
        ...(workspace.workspaceFolders ? workspace.workspaceFolders.map(folder => folder.uri) : []),
        ...(!document.isUntitled ? [Uri.parse(path.dirname(document.fileName))] : [])
      ],
      enableScripts: true 
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // track visual editors
    disposables.push(VisualEditorProvider.visualEditors.track(document, webviewPanel, client.editor));

    // handle disposables when editor is closed
    webviewPanel.onDidDispose(() => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
   
  }

  private editorAssetUri(webview: Webview, file: string) {
    return webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "assets", "www", "editor", file));
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: Webview): string {
   
    const scriptUri = this.editorAssetUri(webview, "index.js");
    const stylesUri = this.editorAssetUri(webview, "style.css");

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <!-- Use a content security policy to only allow scripts that have a specific nonce. -->
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src https: data: ${webview.cspSource}; font-src data:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${stylesUri}" rel="stylesheet" />
            
            <title>Visual Editor</title>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
  }
}

async function navigateToFile(baseDoc: TextDocument, file: string, xref?: XRef) {
  
  const docDir = path.dirname(baseDoc.uri.fsPath);
  const filePath = path.normalize(path.join(docDir, file));
  const uri = Uri.parse(filePath);
  const ext = extname(filePath).toLowerCase();

  const openWith = async (viewType: string) => {
    await commands.executeCommand("vscode.openWith", uri, viewType);
  };

  if (ext === ".qmd") {

    await openWith(VisualEditorProvider.viewType);
  
  } else if (ext === ".ipynb") {
    
    await openWith("jupyter-notebook");
  
  } else {

    const doc = await workspace.openTextDocument(uri);
    await window.showTextDocument(doc, ViewColumn.Active, false);

  }
}

interface TrackedEditor {
  document: TextDocument;
  webviewPanel: WebviewPanel;
  editor: VSCodeVisualEditor;
}

interface VisualEditorTracker {
  track: (document: TextDocument, webviewPanel: WebviewPanel, editor: VSCodeVisualEditor) => Disposable;
  activeEditor: (includeVisible?: boolean) => TrackedEditor | undefined;
}

function visualEditorTracker() : VisualEditorTracker {

  const activeEditors = new Array<TrackedEditor>();

  return {
    track: (document: TextDocument, webviewPanel: WebviewPanel, editor: VSCodeVisualEditor) : Disposable => {
      activeEditors.push({document, webviewPanel, editor});
      return {
        dispose: () => {
          const idx = activeEditors.findIndex(editor => editor.document === document);
          if (idx !== -1) {
            activeEditors.splice(idx, 1);
          }
        }
      };
    },
    activeEditor: (includeVisible?: boolean) => {
      return activeEditors.find(editor => {
        return editor.webviewPanel.active || (includeVisible && editor.webviewPanel.visible);
      });
    }
  };
}