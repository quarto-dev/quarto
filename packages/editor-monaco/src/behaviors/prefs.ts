/*
 * prefs.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { PrefsChangedEvent } from "editor";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext, CodeEditor } from ".";

export function prefsBehavior(context: BehaviorContext): Behavior {

  const configurePrefs = (editor: CodeEditor) => {

    // alias prefs
    const prefs = context.pmContext.ui.prefs;

    // line numbers
    const options = context.options;
    const showLineNumbers = !!options.lineNumbers && prefs.lineNumbers();
    const formatter = options.lineNumberFormatter;
    const lineNumbers: monaco.editor.LineNumbersType = showLineNumbers
      ? (formatter ? (lineNo: number) => formatter(lineNo) : "on")
      : "off";

    const autoClosing = prefs.autoClosingBrackets() ? "languageDefined" : "never";

    editor.updateOptions({
      lineNumbers,
      lineNumbersMinChars: showLineNumbers ? 3 : 0,
      lineDecorationsWidth: showLineNumbers ? 8 : 0,
      selectionHighlight: prefs.highlightSelectedWord(),
      renderWhitespace: prefs.showWhitespace() ? "all" : "none",
      autoClosingBrackets: autoClosing,
      autoClosingQuotes: autoClosing,
      cursorBlinking: prefs.blinkingCursor() ? "blink" : "solid",
      quickSuggestions: prefs.quickSuggestions()
    });

    editor.getModel()?.updateOptions({
      tabSize: prefs.tabWidth(),
      insertSpaces: prefs.spacesForTab()
    });
  };

  let unsubscribe: VoidFunction;

  return {
    init(_pmNode, editor) {
      configurePrefs(editor);
      unsubscribe = context.pmContext.events.subscribe(PrefsChangedEvent, () => {
        configurePrefs(editor);
      });
    },
    cleanup: () => {
      unsubscribe?.();
    }
  };
}
