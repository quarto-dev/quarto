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
  WorkspaceEdit,
  TextEdit,
} from "vscode";

import { QuartoContext } from "quarto-core";

import { VisualEditorHost } from "vscode-types";

import { getNonce } from "../../core/nonce";
import { getWholeRange } from "../../core/doc";

import { visualEditorClient, visualEditorServer } from "./connection";

export function activateEditor(
  context: ExtensionContext,
  quartoContext: QuartoContext
) {
  context.subscriptions.push(VisualEditorProvider.register(context, quartoContext));
}

class VisualEditorProvider implements CustomTextEditorProvider {
  public static register(context: ExtensionContext, quartoContext: QuartoContext): Disposable {
    const provider = new VisualEditorProvider(context, quartoContext);
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

  private static readonly viewType = "quarto.visualEditor";

  constructor(private readonly context: ExtensionContext,
              private readonly quartoContext: QuartoContext) {}

 
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

    // function to set model markdown
    const updateModel = async (markdown: string) => {
      const wholeDocRange = getWholeRange(document);
      const edit = new WorkspaceEdit();
      edit.replace(document.uri, wholeDocRange, markdown);
      await workspace.applyEdit(edit);
    };

    // we are notified of state changes as they occur in the editor, we 
    // periodically collect the state into markdown (expensive) and use
    // it to update the model. we also force this collection when the
    // editor tells us to flush the update or when the user saves
    let suppressNextUpdate = false;
    let pendingVisualEdit: unknown | undefined;
    const collectPendingVisualEdit = async () : Promise<string | undefined> => {
      if (pendingVisualEdit) {
        suppressNextUpdate = true;
        const state = pendingVisualEdit;
        pendingVisualEdit = undefined;
        return client.editor.getMarkdownFromState(state);
      } else {
        return undefined;
      }
    };
    const collectAndApplyPendingVisualEdit = async () => {
      const markdown = await collectPendingVisualEdit();
      if (markdown) {
        await updateModel(markdown);
      }
    };
    setInterval(collectAndApplyPendingVisualEdit, 1500);

    // syncing state between model and visual editor. use supressNextUpdate
    // flag to prevent visual editor => model from pinging back off of itself
    const updateVisualEditorFromModel = async () => {
      if (suppressNextUpdate) {
        suppressNextUpdate = false;
      } else {
        await client.editor.applyTextEdit(document.getText());
      }
    };


    // editor container implementation   
    const host: VisualEditorHost = {

      // editor is fully loaded and ready for communication
      editorReady: async () => {

        // call init w/ document markdown then update the model 
        // with the canonical markdown produced by the editor
        const markdown = await client.editor.init(document.getText());
        await updateModel(markdown);
       
        // subscribe to model changes and update the visual editor when they occur
        // (note that the visual editor throttles these changes internally)
        disposables.push(workspace.onDidChangeTextDocument(
          async (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
              await updateVisualEditorFromModel();
            }
          }
        ));

        // ensure latest markdown before saving
        disposables.push(workspace.onWillSaveTextDocument(
          (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
              if (pendingVisualEdit) {
                const applyPending = async () : Promise<TextEdit[]> => {
                  const edits: TextEdit[] = [];
                  const markdown = await collectPendingVisualEdit();
                  if (markdown) {
                    edits.push(TextEdit.replace(getWholeRange(document), markdown));
                  }
                  return edits;
                };
                e.waitUntil(applyPending());
              }
            }
          }
        ));
      },

      // editor has been updated -- throttle updates unless flush specified
      editorUpdated: async (state: unknown, flush: boolean) => {
        pendingVisualEdit = state;
        if (flush) {
          await collectAndApplyPendingVisualEdit();
        }
      },
    };

    // setup server on webview iframe
    disposables.push(visualEditorServer(
      this.context, 
      this.quartoContext,
      webviewPanel,
      host
    ));

    // load editor webview
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // dispose/disconnect when editor is closed
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

            <!--
            Use a content security policy to only allow loading images from https or from our extension directory,
            and only allow scripts that have a specific nonce.
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            -->

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${stylesUri}" rel="stylesheet" />
            
            <title>Visual Editor</title>
        </head>
        <body>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
  }
}
