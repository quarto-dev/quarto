/*
 * completion.ts
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

import { JsonRpcServerMethod } from "core";
import { CodeViewCompletionContext, CompletionServer, kCompletionGetCodeViewCompletions } from "editor-types";
import { CompletionList } from "vscode-languageserver-types";


export function completionServer() : CompletionServer {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    codeViewCompletions: async (_context: CodeViewCompletionContext) : Promise<CompletionList> => {
      // by default we don't currently do any completions on the server (all done via vdoc in extension host)
      return {
        isIncomplete: false,
        items: []
      };
    }
   
  };
}

export function completionServerMethods(server: CompletionServer) : Record<string, JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [kCompletionGetCodeViewCompletions]: args => server.codeViewCompletions(args[0]),
  }
  return methods;
}
