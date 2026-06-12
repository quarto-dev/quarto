import * as vscode from "vscode";
import { QuartoContext } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";
import { revealSlideIndex } from "../markdown/reveal";
import { QuartoVisualEditor, VisualEditorProvider } from "../providers/editor/editor";
import { notebookFrontMatterYaml } from "../markdown/notebook";
import { documentFrontMatterYaml } from "../markdown/document";

export type QuartoEditor = QuartoTextEditor | QuartoNotebookEditor | QuartoVisualEditor;

export interface QuartoEditorBase {
  document: vscode.TextDocument;
  activate: () => Promise<void>;

  /**
   * Get the slide index for the current cursor position.
   *
   * This method is undefined for editors that don't yet support
   * slide parsing e.g. `QuartoNotebookEditor`.
   */
  slideIndex?: () => Promise<number>;

  selectAndRevealRange: (range: vscode.Range) => void;

  preserveEditorFocus(): void;
}

export interface QuartoTextEditor extends QuartoEditorBase {
  type: 'text';
  textEditor: vscode.TextEditor;
}

export interface QuartoNotebookEditor extends QuartoEditorBase {
  type: 'notebook';
  notebookEditor: vscode.NotebookEditor;
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
  filter: (doc: vscode.TextDocument | vscode.NotebookDocument) => boolean = () => true,
): QuartoEditor | undefined {
  const activeEditor = activeQuartoEditor(filter, engine, context);
  if (activeEditor) {
    return activeEditor;
  }

  // visible visual editor (sometime it loses track of 'active' so we need to use 'visible')
  const visibleVisualEditor = VisualEditorProvider.activeEditor(true);
  if (visibleVisualEditor && filter(visibleVisualEditor.document)) {
    return visibleVisualEditor;
  }

  // visible text editors
  const visibleEditor = vscode.window.visibleTextEditors.find((editor) => filter(editor.document));
  if (visibleEditor) {
    return quartoTextEditor(visibleEditor, engine, context);
  }

  return undefined;
}

export function activeQuartoEditor(
  filter: (doc: vscode.TextDocument | vscode.NotebookDocument) => boolean = () => true,
  engine?: MarkdownEngine,
  context?: QuartoContext
): QuartoEditor | undefined {
  // first check for an active visual editor
  const activeVisualEditor = VisualEditorProvider.activeEditor();
  if (activeVisualEditor && filter(activeVisualEditor.document)) {
    return activeVisualEditor;
  }

  // then check for active notebook editor
  const notebookEditor = vscode.window.activeNotebookEditor;
  if (notebookEditor && filter(notebookEditor.notebook)) {
    return quartoNotebookEditor(notebookEditor);
  }

  // active text editor
  const textEditor = vscode.window.activeTextEditor;
  if (textEditor && filter(textEditor.document)) {
    return quartoTextEditor(textEditor, engine, context);
  }

  return undefined;
}

export function quartoTextEditor(
  editor: vscode.TextEditor,
  engine?: MarkdownEngine,
  context?: QuartoContext): QuartoTextEditor {
  const activate = async () => {
    await vscode.window.showTextDocument(
      editor.document,
      editor.viewColumn,
      false
    );
  };

  return {
    type: 'text',
    document: editor.document,
    activate,
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
    selectAndRevealRange: (range: vscode.Range) => {
      // if the current selection is outside of the error region then
      // navigate to the top of the error region
      if (
        editor.selection.active.isBefore(range.start) ||
        editor.selection.active.isAfter(range.end)
      ) {
        editor.selection = new vscode.Selection(range.start, range.start);
        editor.revealRange(
          range,
          vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
      }
    },
    preserveEditorFocus: () => {
      setTimeout(() => {
        activate();
      }, 200);
    },
    textEditor: editor,
  };
}

function quartoNotebookEditor(
  notebookEditor: vscode.NotebookEditor,
): QuartoNotebookEditor {
  // TODO: Why is cellAt always defined?...
  const firstCellDoc = notebookEditor.notebook.cellAt(0)?.document;
  return {
    type: 'notebook',
    document: firstCellDoc,
    activate: async () => {
      await vscode.window.showNotebookDocument(
        notebookEditor.notebook,
        { preserveFocus: false }
      );
    },
    selectAndRevealRange: (range: vscode.Range) => {
      // Not implemented yet.
    },
    preserveEditorFocus: () => {
      // Not implemented yet.
    },
    notebookEditor,
  };
}

export function editorFrontMatterYaml(editor: QuartoEditor, engine: MarkdownEngine): string {
  if (isQuartoNotebookEditor(editor)) {
    return notebookFrontMatterYaml(editor.notebookEditor.notebook);
  }
  return documentFrontMatterYaml(engine, editor.document);
}
