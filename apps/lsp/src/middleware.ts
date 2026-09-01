/*
 * middleware.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { Connection, ServerCapabilities } from "vscode-languageserver";
import { QUARTO_SEMANTIC_TOKEN_LEGEND } from "quarto-utils";


// capabilities provided just so we can intercept them w/ middleware on the client
export function middlewareCapabilities(): ServerCapabilities {
  return {
    signatureHelpProvider: {
      // assume for now that these cover all languages (we can introduce
      // a refinement system like we do for completion triggers if necessary)
      triggerCharacters: ["(", ","],
      retriggerCharacters: [")"],
    },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    definitionProvider: true,
    semanticTokensProvider: {
      legend: QUARTO_SEMANTIC_TOKEN_LEGEND,
      full: true
    }
  };
};

// methods provided just so we can intercept them w/ middleware on the client
export function middlewareRegister(connection: Connection) {

  connection.onSignatureHelp(async () => {
    return null;
  });

  connection.onDocumentFormatting(async () => {
    return null;
  });

  connection.onDocumentRangeFormatting(async () => {
    return null;
  });

  connection.onDefinition(async () => {
    return null;
  });

  connection.languages.semanticTokens.on(async () => {
    return { data: [] };
  });

}
