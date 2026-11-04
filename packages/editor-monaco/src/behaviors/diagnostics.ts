/*
 * diagnostics.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Diagnostics for code cells (currently yaml validation), shown as monaco
 * markers (squiggles with the message available on hover).
 */

import { Position } from "vscode-languageserver-types";

import {
  CodeViewCellContext,
  codeViewCellContext,
  kEndColumn,
  kEndRow,
  kStartColumn,
  kStartRow,
  LintItem,
  stripYamlFrontmatterDelimiters
} from "editor";
import { lines } from "core";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext, CodeEditor } from ".";

const kMarkerOwner = "quarto";

const EMPTY_CODEVIEW_SELECTION = { start: Position.create(0, 0), end: Position.create(0, 0) };

export function diagnosticsBehavior(behaviorContext: BehaviorContext): Behavior {
  // don't provide behavior if we don't have validation
  if (!behaviorContext.pmContext.ui.codeview) {
    return {};
  }

  // serialize requests so a slow earlier response can't overwrite a later one
  let requestId = 0;

  const updateDiagnostics = async (cellContext: CodeViewCellContext, editor: CodeEditor) => {
    const id = ++requestId;
    const diagnostics = await getDiagnostics(cellContext, behaviorContext);
    const model = editor.getModel();
    if (id !== requestId || !model || model.isDisposed()) {
      return;
    }
    setMarkers(model, diagnostics || []);
  };

  return {
    async init(pmNode, editor) {
      const language = behaviorContext.options.lang(pmNode, pmNode.textContent);
      if (language !== "yaml-frontmatter") return;

      const filepath = behaviorContext.pmContext.ui.context.getDocumentPath();
      if (filepath === null) return;

      const code = lines(pmNode.textContent);
      const strippedCodeLines = stripYamlFrontmatterDelimiters(code);

      // here we hand-craft a cellContext because `codeViewCellContext(..)`
      // returns undefined inside of init (the selection isn't in the cell yet)
      const cellContext = {
        filepath,
        language: 'yaml',
        code: strippedCodeLines,
        cellBegin: 0,
        cellEnd: code.length - 1,
        selection: EMPTY_CODEVIEW_SELECTION
      };

      await updateDiagnostics(cellContext, editor);
    },

    async pmUpdate(_, _updatePmNode, editor) {
      const filepath = behaviorContext.pmContext.ui.context.getDocumentPath();
      if (filepath === null) return;

      const cellContext = codeViewCellContext(filepath, behaviorContext.view.state);
      if (cellContext === undefined) return;

      await updateDiagnostics(cellContext, editor);
    },

    cleanup() {
      requestId++;
    }
  };
}

async function getDiagnostics(
  cellContext: CodeViewCellContext,
  behaviorContext: BehaviorContext
): Promise<LintItem[] | undefined> {
  return await behaviorContext.pmContext.ui.codeview?.codeViewDiagnostics(cellContext);
}

function setMarkers(model: monaco.editor.ITextModel, diagnostics: LintItem[]) {
  const markers = diagnostics.map((item): monaco.editor.IMarkerData => ({
    severity: severityForType(item.type),
    message: item.text,
    // lint items are 0-based, monaco positions are 1-based
    startLineNumber: item[kStartRow] + 1,
    startColumn: item[kStartColumn] + 1,
    endLineNumber: item[kEndRow] + 1,
    endColumn: item[kEndColumn] + 1
  }));
  monaco.editor.setModelMarkers(model, kMarkerOwner, markers);
}

function severityForType(type: string): monaco.MarkerSeverity {
  switch (type) {
    case "warning":
      return monaco.MarkerSeverity.Warning;
    case "info":
    case "information":
      return monaco.MarkerSeverity.Info;
    case "hint":
      return monaco.MarkerSeverity.Hint;
    case "error":
    default:
      return monaco.MarkerSeverity.Error;
  }
}
