/*
 * yamloption.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Continue `#| ` option comment lines when the user presses Enter on one
 * (and clear the line when Enter is pressed on an empty `#|`).
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';

import { editorLanguage } from "editor-core";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext, CodeEditor } from ".";

const kOnOptionComment = "quartoCodeViewOnOptionComment";

export function yamlOptionBehavior(context: BehaviorContext): Behavior {

  // track current option comment prefix (e.g. "#| ") for the node's language
  let optionComment: string | undefined;
  const updateLanguage = (nd: ProsemirrorNode) => {
    const language = context.options.lang(nd, nd.textContent) || '';
    const langComment = editorLanguage(language)?.comment;
    optionComment = langComment ? `${langComment}| ` : undefined;
  };

  return {

    init(pmNode, editor) {
      updateLanguage(pmNode);

      // context key: is the cursor on an option comment line?
      const onOptionComment = editor.createContextKey<boolean>(kOnOptionComment, false);
      const updateContextKey = () => {
        const line = currentLine(editor);
        onOptionComment.set(
          !!optionComment && !!line &&
          (line.trim() === optionComment.trim() || line.startsWith(optionComment))
        );
      };
      editor.onDidChangeCursorPosition(updateContextKey);
      editor.onDidChangeModelContent(updateContextKey);

      editor.addAction({
        id: "quarto.codeview.optionCommentEnter",
        label: "Continue Option Comment",
        keybindings: [monaco.KeyCode.Enter],
        precondition: `${kOnOptionComment} && !suggestWidgetVisible && !inSnippetMode && !parameterHintsVisible`,
        run: (ed) => {
          const line = currentLine(ed as CodeEditor);
          if (!optionComment || line === undefined) {
            return;
          }
          const model = ed.getModel()!;
          const lineNumber = ed.getPosition()!.lineNumber;
          if (line.trim() === optionComment.trim()) {
            // empty option comment: clear it and move to a fresh line
            ed.executeEdits("quarto", [{
              range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
              text: "\n"
            }]);
            ed.setPosition({ lineNumber: lineNumber + 1, column: 1 });
          } else {
            // continue the option comment on the next line
            ed.trigger("keyboard", "type", { text: "\n" });
            const pos = ed.getPosition()!;
            ed.executeEdits("quarto", [{
              range: monaco.Range.fromPositions(pos, pos),
              text: optionComment
            }]);
            ed.setPosition({ lineNumber: pos.lineNumber, column: pos.column + optionComment.length });
          }
        }
      });
    },

    pmUpdate: (_prevNode, updateNode) => {
      updateLanguage(updateNode);
    }
  };
}

function currentLine(editor: CodeEditor): string | undefined {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (model && pos) {
    return model.getLineContent(pos.lineNumber);
  }
  return undefined;
}
