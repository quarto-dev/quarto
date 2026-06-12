import * as vscode from "vscode";
import { QuartoContext } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";
import { revealSlideIndex } from "../markdown/reveal";
import { QuartoVisualEditor, VisualEditorProvider } from "../providers/editor/editor";

export type QuartoEditor = QuartoTextEditor | QuartoNotebookEditor | QuartoVisualEditor;

export interface QuartoEditorBase {
  document: vscode.TextDocument;
  activate: () => Promise<void>;
  viewColumn?: vscode.ViewColumn;

  /**
   * Get the slide index for the current cursor position.
   *
   * This method is undefined for editors that don't yet support
   * slide parsing e.g. `QuartoNotebookEditor`.
   */
  slideIndex?: () => Promise<number>;
}

export interface QuartoTextEditor extends QuartoEditorBase {
  type: 'text';
  textEditor: vscode.TextEditor;
}

export interface QuartoNotebookEditor extends QuartoEditorBase {
  type: 'notebook';
  notebook: vscode.NotebookDocument;
}

export function isQuartoNotebookEditor(editor: QuartoEditor): editor is QuartoNotebookEditor {
  return editor.type === 'notebook';
}

export function isQuartoTextEditor(editor: QuartoEditor): editor is QuartoTextEditor {
  return editor.type === 'text';
}

export function isQuartoVisualEditor(editor: QuartoEditor): editor is QuartoVisualEditor {
  return editor.type === 'visual';
}

export function findQuartoEditor(
  engine: MarkdownEngine,
  context: QuartoContext,
  filter: (doc: vscode.TextDocument | vscode.NotebookDocument) => boolean
): QuartoEditor | undefined {
  // first check for an active visual editor
  const activeVisualEditor = VisualEditorProvider.activeEditor();
  if (activeVisualEditor && filter(activeVisualEditor.document)) {
    return activeVisualEditor;
  }

  // then check for active notebook editor
  const notebookEditor = vscode.window.activeNotebookEditor;
  if (notebookEditor && filter(notebookEditor.notebook)) {
    // TODO: Why is cellAt always defined?...
    const firstCellDoc = notebookEditor.notebook.cellAt(0)?.document;
    if (firstCellDoc) {
      return quartoNotebookEditor(notebookEditor, firstCellDoc);
    }
  }

  // active text editor
  const textEditor = vscode.window.activeTextEditor;
  if (textEditor && filter(textEditor.document)) {
    return quartoTextEditor(textEditor, engine, context);
    // check visible text editors
  } else {
    // visible visual editor (sometime it loses track of 'active' so we need to use 'visible')
    const visibleVisualEditor = VisualEditorProvider.activeEditor(true);
    if (visibleVisualEditor && filter(visibleVisualEditor.document)) {
      return visibleVisualEditor;
    }

    // visible text editors
    const visibleEditor = vscode.window.visibleTextEditors.find((editor) => filter(editor.document)
    );
    if (visibleEditor) {
      return quartoTextEditor(visibleEditor, engine, context);
    } else {
      return undefined;
    }
  }
}

export function quartoTextEditor(
  editor: vscode.TextEditor,
  engine?: MarkdownEngine,
  context?: QuartoContext): QuartoTextEditor {
  return {
    type: 'text',
    document: editor.document,
    activate: async () => {
      await vscode.window.showTextDocument(
        editor.document,
        editor.viewColumn,
        false
      );
    },
    slideIndex: async () => {
      if (engine && context) {
        return await revealSlideIndex(
          editor.selection.active,
          editor.document,
          engine,
          context
        );
      } else {
        return 0;
      }
    },
    viewColumn: editor.viewColumn,
    textEditor: editor,
  };
}

function quartoNotebookEditor(
  notebookEditor: vscode.NotebookEditor,
  firstCellDoc: vscode.TextDocument
): QuartoNotebookEditor {
  return {
    type: 'notebook',
    document: firstCellDoc,
    activate: async () => {
      await vscode.window.showNotebookDocument(
        notebookEditor.notebook,
        { viewColumn: notebookEditor.viewColumn, preserveFocus: false }
      );
    },
    viewColumn: notebookEditor.viewColumn,
    notebook: notebookEditor.notebook,
  };
}

export function preserveEditorFocus(editor?: QuartoEditor) {
  // focus the editor (sometimes the terminal steals focus)
  editor =
    editor ||
    (vscode.window.activeTextEditor
      ? quartoTextEditor(vscode.window.activeTextEditor)
      : undefined);
  if (editor) {
    if (!isQuartoNotebookEditor(editor)) {
      setTimeout(() => {
        if (editor) {
          editor.activate();
        }
      }, 200);
    }
  } else {
    // see if there is a visual editor we should be preserving focus for
    const visualEditor = VisualEditorProvider.activeEditor();
    if (visualEditor) {
      setTimeout(async () => {
        if (!(await visualEditor.hasFocus())) {
          await visualEditor.activate();
        }
      }, 200);
    }
  }
}
