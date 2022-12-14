/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
} from "vscode-languageserver/node";
import {
  editorContext,
  kEndColumn,
  kEndRow,
  kStartColumn,
  kStartRow,
  LintItem,
  quarto,
} from "../quarto/quarto";

export async function provideDiagnostics(
  doc: TextDocument
): Promise<Diagnostic[]> {
  // bail if no quarto connection
  if (!quarto) {
    return [];
  }

  if (quarto) {
    const context = editorContext(doc, Position.create(0, 0), true);
    const diagnostics = await quarto.getYamlDiagnostics(context);
    return diagnostics.map((item) => {
      return {
        severity: lintSeverity(item),
        range: Range.create(
          item[kStartRow],
          item[kStartColumn],
          item[kEndRow],
          item[kEndColumn]
        ),
        message: item.text,
        source: "quarto",
      };
    });
  } else {
    return [];
  }
}

function lintSeverity(item: LintItem) {
  if (item.type === "error") {
    return DiagnosticSeverity.Error;
  } else if (item.type === "warning") {
    return DiagnosticSeverity.Warning;
  } else {
    return DiagnosticSeverity.Information;
  }
}
