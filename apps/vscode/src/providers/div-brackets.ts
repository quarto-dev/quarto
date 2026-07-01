/*
 * div-brackets.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as vscode from 'vscode';
import { markdownitParser, Token } from 'quarto-core';
import { createThrottle } from '../core/throttle';

// Define decoration types for different nesting levels (rotating colors)
const decorationTypes = [
  vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorBracketHighlight.foreground1'),
  }),
  vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorBracketHighlight.foreground2'),
  }),
  vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorBracketHighlight.foreground3'),
  }),
];

// Decoration type for matching pairs when cursor is on a bracket
const matchHighlightDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
  border: '1px solid',
  borderRadius: '6px',
  borderColor: new vscode.ThemeColor('editor.wordHighlightBorder'),
  color: new vscode.ThemeColor('editor.foreground'),
});

/**
 * Provides colored decorations for div bracket pairs (:::)
 *
 * This gives visual feedback similar to bracket pair colorization,
 * but works for Quarto's context-sensitive div syntax.
 */
export function activateDivBracketDecorations(context: vscode.ExtensionContext) {
  const parser = markdownitParser();

  // Read debounce delay from config
  const getDelayMs = () =>
    vscode.workspace.getConfiguration('quarto').get('cells.background.delay', 250);

  // Cache for parsed tokens
  const parseCache = new Map<string, {
    version: number;
    divTokens: Token[];
  }>();

  // Map of editors to their throttled update functions
  const editorThrottledFunctions = new Map<vscode.TextEditor, () => void>();

  function updateDecorations(editor: vscode.TextEditor) {
    if (editor.document.languageId !== 'quarto') return;

    const docUri = editor.document.uri.toString();
    const docVersion = editor.document.version;

    // Check cache
    let divTokens: Token[];
    const cached = parseCache.get(docUri);
    if (cached && cached.version === docVersion) {
      divTokens = cached.divTokens;
    } else {
      // Parse the document
      const doc = {
        getText: () => editor.document.getText(),
        uri: docUri,
        version: docVersion,
        lineCount: editor.document.lineCount,
      };

      divTokens = parser(doc as any).filter(t => t.type === 'Div');
      parseCache.set(docUri, { version: docVersion, divTokens });
    }

    // Group decorations by nesting level
    const decorationsByLevel = decorationTypes.map(() => [] as vscode.Range[]);
    const matchHighlights: vscode.Range[] = [];

    const divDepth = getDivDepths(divTokens);

    // Apply decorations
    for (const divToken of divTokens) {
      const openLine = divToken.range.start.line;
      const closeLine = divToken.range.end.line;
      const depth = divDepth.get(divToken)!;
      const colorIndex = depth % decorationTypes.length;
      const cursorLine = editor.selection.active.line;
      const isCursorOver = cursorLine === openLine || cursorLine === closeLine;

      const openRange = getDivMarkerRange(editor, openLine);
      const closeRange = getDivMarkerRange(editor, closeLine);

      const targetList = isCursorOver ?
        matchHighlights :
        decorationsByLevel[colorIndex];
      if (openRange) targetList.push(openRange);
      if (closeRange) targetList.push(closeRange);
    }

    decorationTypes.forEach((decorationType, i) =>
      editor.setDecorations(decorationType, decorationsByLevel[i])
    );
    editor.setDecorations(matchHighlightDecorationType, matchHighlights);
  }

  function updateDecorationsThrottled(editor: vscode.TextEditor) {
    let throttled = editorThrottledFunctions.get(editor);
    if (!throttled) {
      throttled = createThrottle(() => updateDecorations(editor), getDelayMs);
      editorThrottledFunctions.set(editor, throttled);
    }
    throttled();
  }

  // Update decorations when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        updateDecorationsThrottled(editor);
      }
    })
  );

  // Update decorations when document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        updateDecorationsThrottled(editor);
      }
    })
  );

  // Update decorations when cursor moves
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(event => {
      updateDecorationsThrottled(event.textEditor);
    })
  );

  // Clean up cache and throttle state when document is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      parseCache.delete(document.uri.toString());
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(visibleEditors => {
      for (const editor of editorThrottledFunctions.keys()) {
        if (!visibleEditors.includes(editor)) {
          editorThrottledFunctions.delete(editor);
        }
      }
    })
  );

  // Update decorations for the active editor now
  for (const editor of vscode.window.visibleTextEditors) {
    updateDecorationsThrottled(editor);
  }

  // Clean up decoration types on deactivation
  context.subscriptions.push({
    dispose: () => {
      decorationTypes.forEach(type => type.dispose());
    }
  });
}

/**
 * Helper to extract ::: range from a line
 */
export const getDivMarkerRange = (editor: vscode.TextEditor, line: number): vscode.Range | null => {
  const lineText = editor.document.lineAt(line).text;
  const match = lineText.match(/^(:::+)/);
  return match ? new vscode.Range(line, 0, line, match[1].length) : null;
};

/**
 * Helper to calculate the nesting depths of divs (how many divs a div is nested inside)
 * e.g.
 * ```
 * ::::
 * depth 0 ^
 * :::
 * depth 1 ^
 * :::
 * ::::
 * :::
 * depth 0 again
 * :::
 * ```
 */
export function getDivDepths(divTokens: Token[]): Map<Token, number> {
  // Calculate nesting depth for all divs in a single pass using a stack
  const divDepth = new Map<Token, number>();
  const stack: Token[] = [];
  for (const divToken of divTokens) {
    // Pop divs from stack that have ended before this div starts
    while (stack.length > 0 && stack.at(-1)!.range.end.line < divToken.range.start.line) {
      stack.pop();
    }
    divDepth.set(divToken, stack.length);
    stack.push(divToken);
  }
  return divDepth;
}
