/*
 * firstlinemeta.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * For code views whose first line is metadata (e.g. the `{r}` line of a code
 * chunk), render that line in a lighter color.
 */

import { Behavior, BehaviorContext } from ".";

import { monaco } from "../monaco";

export function firstLineMetaBehavior(context: BehaviorContext): Behavior {

  if (!context.options.firstLineMeta) {
    return {};
  }

  let decorations: monaco.editor.IEditorDecorationsCollection | undefined;

  return {
    init(_pmNode, editor) {
      decorations = editor.createDecorationsCollection([{
        range: new monaco.Range(1, 1, 1, 1),
        options: {
          isWholeLine: true,
          inlineClassName: "pm-monaco-first-line-meta",
          // keep the decoration on the first line as it is edited
          stickiness: monaco.editor.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore
        }
      }]);
      // the decoration can get pushed off line 1 when text is inserted at the
      // very start, so pin it back after every change
      editor.onDidChangeModelContent(() => {
        decorations?.set([{
          range: new monaco.Range(1, 1, 1, 1),
          options: { isWholeLine: true, inlineClassName: "pm-monaco-first-line-meta" }
        }]);
      });
    },
    cleanup() {
      decorations?.clear();
    }
  };
}
