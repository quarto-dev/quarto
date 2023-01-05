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

import { VSCodeVisualEditorHost, XRef } from "editor-types";

import { getNonce } from "../../core/nonce";

import { visualEditorClient, visualEditorServer } from "./connection";
import { editorSyncManager } from "./sync";
import path, { extname } from "path";

export function activateEditor(
  context: ExtensionContext,
  lspClient: LanguageClient
) {
  context.subscriptions.push(VisualEditorProvider.register(context, lspClient));
}

class VisualEditorProvider implements CustomTextEditorProvider {
  public static register(
    context: ExtensionContext, 
    lspClient: LanguageClient
  ) : Disposable {
    const provider = new VisualEditorProvider(context, lspClient);
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

  constructor(private readonly context: ExtensionContext,
              private readonly lspClient: LanguageClient) {}

 
  public async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    _token: CancellationToken
  ): Promise<void> {

    // track disposables
    const disposables: Disposable[] = [];

    // get visual editor client
    const client = visualEditorClient(webviewPanel);
    disposables.push(client);

    // sync manager
    const syncManager = editorSyncManager(document, client.editor);

    // editor container implementation   
    const host: VSCodeVisualEditorHost = {
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

      openURL: function (url: string): void {
        env.openExternal(Uri.parse(url));
      },
      navigateToXRef: function (file: string, xref: XRef): void {
        navigateToFile(document, file, xref);
      },
      navigateToFile: function (file: string): void {
        navigateToFile(document, file);
      }
    };

    // setup server on webview iframe
    disposables.push(visualEditorServer(webviewPanel, this.lspClient, host));

    // load editor webview
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src data:;">
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