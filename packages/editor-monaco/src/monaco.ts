/*
 * monaco.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * One-time global setup for the Monaco editor: the editor API, the subset of
 * editor features we use, and the web worker used by Monaco's editor services.
 */

/// <reference types="vite/client" />

import * as monaco from "monaco-editor/editor/editor.api";

// editor features (each import registers a contribution)
import "monaco-editor/features/codeEditor/register";
import "monaco-editor/features/suggest/register";
import "monaco-editor/features/hover/register";
import "monaco-editor/features/snippet/register";
import "monaco-editor/features/bracketMatching/register";
import "monaco-editor/features/indentation/register";
import "monaco-editor/features/wordOperations/register";
import "monaco-editor/features/wordPartOperations/register";
import "monaco-editor/features/linesOperations/register";
import "monaco-editor/features/clipboard/register";
import "monaco-editor/features/cursorUndo/register";
import "monaco-editor/features/smartSelect/register";
import "monaco-editor/features/wordHighlighter/register";
import "monaco-editor/features/multicursor/register";
import "monaco-editor/features/comment/register";
import "monaco-editor/features/caretOperations/register";
import "monaco-editor/features/dnd/register";
import "monaco-editor/features/tokenization/register";

// the editor worker, inlined into the bundle as a blob url so that it can be
// created inside a vscode webview (whose resources live on a different origin)
import EditorWorker from "monaco-editor/editor/editor.worker?worker&inline";

export { monaco };

let initialized = false;

export function initMonaco() {
  if (initialized) {
    return;
  }
  initialized = true;

  self.MonacoEnvironment = {
    getWorker: () => new EditorWorker()
  };
}
