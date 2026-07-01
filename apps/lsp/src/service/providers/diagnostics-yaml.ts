/*
 * diagnostics.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
} from "vscode-languageserver";

import { Document } from "quarto-core";

import {
  docEditorContext
} from "../quarto";
import { Quarto } from "../../quarto";
import { kEndColumn, kEndRow, kStartColumn, kStartRow, LintItem } from "editor-types";

export async function provideYamlDiagnostics(
  quarto: Quarto,
  doc: Document
): Promise<Diagnostic[]> {

  const context = docEditorContext(doc, Position.create(0, 0), true);
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
