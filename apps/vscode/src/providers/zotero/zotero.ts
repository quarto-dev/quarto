/*
 * zotero.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
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

import { ExtensionContext, ProgressLocation, commands, window, workspace } from "vscode";
import { zoteroApi, zoteroSyncWebLibraries, zoteroValidateApiKey } from "editor-server";

import { Command } from "../../core/command";
import { LanguageClient } from "vscode-languageclient/node";
import { lspClientTransport } from "core-node";
import { editorZoteroJsonRpcServer } from "editor-core";
import { ZoteroServer } from "editor-types";

const kQuartoZoteroWebApiKey = "quartoZoteroWebApiKey";

const kZoteroConfigureLibrary = "quarto.zoteroConfigureLibrary";
const kZoteroSyncWebLibrary = "quarto.zoteroSyncWebLibrary";

export async function activateZotero(context: ExtensionContext, lspClient: LanguageClient) : Promise<Command[]> {

  const lspRequest = lspClientTransport(lspClient);
  const zotero = editorZoteroJsonRpcServer(lspRequest);  

  const zoteroKey = await context.secrets.get(kQuartoZoteroWebApiKey);
  if (zoteroKey) {
    await zotero.setWebAPIKey(zoteroKey);
  }

  const commands: Command[] = [];

  commands.push(new ZoteroConfigureLibraryCommand(kZoteroConfigureLibrary, context, zotero));
  commands.push(new ZoteroSyncWebLibraryCommand(kZoteroSyncWebLibrary, context, zotero));

  return commands;

}

export class ZoteroSyncWebLibraryCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context: ExtensionContext,
    private readonly zotero: ZoteroServer
  ) {}

  async execute() {
    const apiKey = await this.context.secrets.get(kQuartoZoteroWebApiKey);
    if (apiKey) {
      await syncWebLibraries(apiKey);
    } else {
      const result = await window.showInformationMessage(
        "Zotero Web Library Not Configured",
        { 
          modal: true, 
          detail: `You do not currently have a Zotero web library configured.` +
                  `Do you want to configure a web library now?` },
        "Yes",
        "No"
      );
      if (result === "Yes") {
        await commands.executeCommand(kZoteroConfigureLibrary);
      }
    }
  }
}

export class ZoteroConfigureLibraryCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context: ExtensionContext,
    private readonly zotero: ZoteroServer
  ) {}

  async execute() {

    const inputBox = window.createInputBox();
    inputBox.title = "Connect Zotero Web Library";
    inputBox.prompt = "Provide a Zotero Web API key to enable support for Zotero citations in " +
                      "the Quarto Visual Editor. You can generate keys at https://www.zotero.org/settings/keys";
    inputBox.password = true;     
    inputBox.ignoreFocusOut = true;            
    inputBox.placeholder = "Zotero Web API Key";
    inputBox.onDidAccept(async () => {
    
      // get key 
      const apiKey = inputBox.value.trim();

      // helper to save it
      const saveApiKey = async () => {
        await this.context.secrets.store(kQuartoZoteroWebApiKey,apiKey);
        await this.zotero.setWebAPIKey(apiKey);
        inputBox.hide();
      };

      if (apiKey) {
        const valid = await zoteroValidateApiKey(apiKey);
        if (!valid) {
          inputBox.validationMessage = "The API key you entered could not be validated with the Zotero web service. " + 
                                      "Please ensure that you have entered the key correctly and that it is currently valid.";
        } else {
          // save the secret and notify the server
          await saveApiKey();

          // kickoff a sync
          await syncWebLibraries(apiKey);
        }
      } else {
        await saveApiKey();
      }     
    });
    inputBox.onDidChangeValue(() => {
      inputBox.validationMessage = "";
    });

    inputBox.show();
  }

}

async function syncWebLibraries(apiKey: string) {

  window.withProgress({
    title: "Zotero Sync",
    location: ProgressLocation.Notification,
    cancellable: true
  }, async (progress, token) => {

    // progress handler
    let progressRemaining = 100;
    const progressHandler = {
      report(message: string, increment?: number) {
        if (token.isCancellationRequested) {
          throw new SyncCancelledError();
        }
        increment = increment || (progressRemaining * 0.1);
        progressRemaining -= increment;
        progress.report( { message, increment });
      },
      log() {
        // don't log in foreground sync
      },
      cancelled() {
        return token.isCancellationRequested;
      }
    };

    // perform sync
    try {
      const zotero = await zoteroApi(apiKey, progressHandler);
      await zoteroSyncWebLibraries(zotero, progressHandler);
    } catch(error) {
      if (!(error instanceof SyncCancelledError)) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        window.showErrorMessage("Error occurred during sync: " + message);
        console.error(error);
      }
    }
  });
}

class SyncCancelledError extends Error {
  constructor() {
    super("Sync Cancelled");
  }
}