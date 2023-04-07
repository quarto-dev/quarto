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

import { ExtensionContext, window } from "vscode";
import { zoteroApi, zoteroSyncWebLibraries, zoteroValidateApiKey } from "editor-server";

import { Command } from "../../core/command";
import { LanguageClient } from "vscode-languageclient/node";
import { lspClientTransport } from "core-node";
import { editorZoteroJsonRpcServer } from "editor-core";
import { ZoteroServer } from "editor-types";

const kQuartoZoteroWebApiKey = "quartoZoteroWebApiKey";

export async function activateZotero(context: ExtensionContext, lspClient: LanguageClient) : Promise<Command[]> {

  const lspRequest = lspClientTransport(lspClient);
  const zotero = editorZoteroJsonRpcServer(lspRequest);  

  const zoteroKey = await context.secrets.get(kQuartoZoteroWebApiKey);
  if (zoteroKey) {
    await zotero.setWebAPIKey(zoteroKey);
  }

  const commands: Command[] = [];

  commands.push(new ConfigureZoteroCommand("quarto.configureZotero", context, zotero));

  return commands;

}

export class ConfigureZoteroCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context: ExtensionContext,
    private readonly zotero: ZoteroServer
  ) {}

  async execute() {

    const inputBox = window.createInputBox();
    inputBox.title = "Configure Zotero";
    inputBox.prompt = "Provide a Zotero Web API key to enable support for Zotero citations in " +
                      "the Quarto Visual Editor. You can generate keys at https://www.zotero.org/settings/keys";
    inputBox.password = true;     
    inputBox.ignoreFocusOut = true;            
    inputBox.placeholder = "Zotero Web API Key";
    inputBox.onDidAccept(async () => {
    
      // validate key
      const apiKey = inputBox.value.trim();
      const valid = await zoteroValidateApiKey(apiKey);
      if (!valid) {
        inputBox.validationMessage = "The API key you entered could not be validated with the Zotero web service. " + 
                                     "Please ensure that you have entered the key correctly and that it is currently valid.";
      } else {
        // save the secret and notify the server
        await this.context.secrets.store(kQuartoZoteroWebApiKey,apiKey);
        await this.zotero.setWebAPIKey(apiKey);

        // hide the input box
        inputBox.hide();

        // kickoff a sync
        const zotero = await zoteroApi(apiKey);
        zoteroSyncWebLibraries(zotero);
      }
     
    });
    inputBox.onDidChangeValue(() => {
      inputBox.validationMessage = "";
    });

    inputBox.show();
  }

}