/*
 * index.ts
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

import * as fs from "fs";
import path from "path";

import { 
  defaultEditorServerOptions, 
  dictionaryServerMethods, 
  editorServerMethods, 
  mathServerMethods,
  EditorServerOptions,
  sourceServerMethods,
  completionServerMethods,
} from "editor-server"

import { LspConnection, registerLspServerMethods } from "core-node";
import { QuartoContext, userDictionaryDir } from "quarto-core";
import { CompletionList } from "vscode-languageserver-types";
import { Position, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { CodeViewCompletionContext, CompletionServer } from "editor-types";
import { codeEditorContext } from "./quarto/quarto";
import { yamlCompletions } from "./providers/completion/completion-yaml";

export function registerCustomMethods(
  quartoContext: QuartoContext, 
  connection: LspConnection,
  documents: TextDocuments<TextDocument>
) {

  const resourcesDir = path.join(__dirname, "resources");

  const options : EditorServerOptions = {
    ...defaultEditorServerOptions(
      quartoContext,
      resourcesDir,
      quartoContext.pandocPath
    ),
    documents: {
      getCode(filePath: string) {
        const uri = URI.file(filePath).toString();
        const doc = documents.get(uri);
        if (doc) {
          return doc.getText();
        } else {
          return fs.readFileSync(filePath, { encoding: "utf-8" });
        }
      }
    }
  };

  const dictionary = {
    dictionariesDir: path.join(resourcesDir, "dictionaries"),
    userDictionaryDir: userDictionaryDir()
  };

  registerLspServerMethods(connection, {
    ...editorServerMethods(options),
    ...dictionaryServerMethods(dictionary),
    ...mathServerMethods(options.documents),
    ...sourceServerMethods(options.pandoc),
    ...completionServerMethods(lspCompletionServer())
  });
}

function lspCompletionServer() : CompletionServer {
  return {
    codeViewCompletions: async (context: CodeViewCompletionContext) : Promise<CompletionList> => {
      
      if (context.language == "yaml") {
        const edContext = codeEditorContext(
          context.filepath,
          "yaml",
          context.code.join("\n"),
          Position.create(context.cursorPos.row, context.cursorPos.col),
          true,
          context.explicit
        );
        const completions = await yamlCompletions(edContext);
        if (completions) {
          return {
            isIncomplete: false,
            items: completions
          }
        }
      } 


      // no completions for this language
      return {
        isIncomplete: false,
        items: []
      };
    }
   
  };
}