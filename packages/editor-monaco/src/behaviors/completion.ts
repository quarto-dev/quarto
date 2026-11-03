/*
 * completion.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Completions for code cells (provided by the host via the code view server).
 * Monaco completion providers are global (per language), so a single provider
 * is registered for all languages and dispatches to the code view that owns
 * the model being completed.
 */

import {
  CompletionItem,
  CompletionItemKind,
  InsertReplaceEdit,
  InsertTextFormat,
  MarkupContent,
  MarkupKind,
  TextEdit
} from "vscode-languageserver-types";

import { editorLanguage } from "editor-core";

import { CodeViewCompletionContext, codeViewCompletionContext } from "editor";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext } from ".";
import { escapeRegExpCharacters } from "core";

// code views registered for completion (keyed by model uri)
const codeViews = new Map<string, BehaviorContext>();

// set while an explicit (ctrl+space) completion request is in flight
let explicitRequest = false;

let providerRegistered = false;

export function completionBehavior(behaviorContext: BehaviorContext): Behavior {

  // don't provide behavior if we don't have completions
  if (!behaviorContext.pmContext.ui.codeview) {
    return {};
  }

  registerProvider();

  let modelUri: string | undefined;

  return {
    init(_pmNode, editor) {
      const model = editor.getModel();
      if (model) {
        modelUri = model.uri.toString();
        codeViews.set(modelUri, behaviorContext);
      }

      // explicit completion request (so we can distinguish it from quick suggestions)
      editor.addAction({
        id: "quarto.codeview.triggerSuggest",
        label: "Trigger Suggest",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space],
        run: (ed) => {
          explicitRequest = true;
          ed.trigger("keyboard", "editor.action.triggerSuggest", {});
        }
      });
    },
    cleanup() {
      if (modelUri) {
        codeViews.delete(modelUri);
      }
    }
  };
}

function registerProvider() {
  if (providerRegistered) {
    return;
  }
  providerRegistered = true;

  monaco.languages.registerCompletionItemProvider("*", {
    triggerCharacters: [".", "$", "@", ":", ">", "/"],
    provideCompletionItems: async (model, position, _context, token) => {

      // was this an explicit request?
      const explicit = explicitRequest;
      explicitRequest = false;

      // find the code view that owns this model
      const behaviorContext = codeViews.get(model.uri.toString());
      if (!behaviorContext) {
        return null;
      }

      // no completions if there is no path
      const filepath = behaviorContext.pmContext.ui.context.getDocumentPath();
      if (!filepath) {
        return null;
      }

      // see if there is a completion context
      const cvContext = codeViewCompletionContext(filepath, behaviorContext.view.state, explicit);
      if (!cvContext) {
        return null;
      }

      // check if this is a known editor language
      const language = editorLanguage(cvContext.language);
      if (!language) {
        return null;
      }

      // if we don't have quick suggestions enabled and this isn't explicit then bail
      if (!behaviorContext.pmContext.ui.prefs.quickSuggestions() && !explicit) {
        return null;
      }

      // text on the line before the cursor
      const textBefore = model.getValueInRange(new monaco.Range(
        position.lineNumber, 1, position.lineNumber, position.column
      ));

      // if we aren't explicit then filter based on match (letter + wordchar + optional trigger chars)
      if (!explicit) {
        const trigger = (language.trigger || ["."]);
        const regex = new RegExp('(^|[ \t])[\\\\A-Za-z_\\.][\\w_\\(\\)\\[\\]' + escapeRegExpCharacters(trigger.join('')) + ']*$');
        if (!textBefore.match(regex)) {
          return null;
        }
      }

      // get completions
      if (token.isCancellationRequested) {
        return null;
      }
      return getCompletions(model, position, textBefore, cvContext, behaviorContext);
    }
  });
}

const compareBySortText = (a: CompletionItem, b: CompletionItem) => {
  if (a.sortText && b.sortText) {
    return a.sortText.localeCompare(b.sortText);
  } else {
    return 0;
  }
};

// compute the column the completion replaces from (the cursor column less the
// length of the text the item's edit replaces)
const itemFromColumn = (item: CompletionItem, cursorColumn: number) => {
  return item.textEdit
    ? InsertReplaceEdit.is(item.textEdit)
      ? cursorColumn - (item.textEdit.insert.end.character - item.textEdit.insert.start.character)
      : TextEdit.is(item.textEdit)
        ? cursorColumn - (item.textEdit.range.end.character - item.textEdit.range.start.character)
        : cursorColumn
    : cursorColumn;
};

/**
 * replaceText for a given CompletionItem is the text that is already in the document
 * that that CompletionItem will replace.
 *
 * Example 1: if you are typing `lib` and get the completion `library`, then this function
 *   will give `lib`.
 * Example 2: if you are typing `os.a` and get the completion `abc`, then this function
 *   will give `a`.
 */
const getReplaceText = (textBefore: string, item: CompletionItem, cursorColumn: number) =>
  textBefore.slice(itemFromColumn(item, cursorColumn) - 1);

const sortTextItemsBoostScore = (textBefore: string, cursorColumn: number, items: CompletionItem[], index: number) => {
  const total = items.length;
  const item = items[index];
  // compute replaceText
  const replaceText = getReplaceText(textBefore, item, cursorColumn);

  // if the replaceText doesn't start with "." then bury items that do
  if (!replaceText.startsWith(".") && item.label.startsWith(".")) {
    return -99;
  }

  // only boost things that have a prefix match
  if (item.label.toLowerCase().startsWith(replaceText) ||
    (item.textEdit && item.textEdit.newText.toLowerCase().startsWith(replaceText)) ||
    (item.insertText && item.insertText.toLowerCase().startsWith(replaceText))) {
    return -99 + Math.round(((total - index) / total) * 198);
  } else {
    return -99;
  }
};

const defaultBoostScore = (textBefore: string, cursorColumn: number, items: CompletionItem[], index: number) => {
  const item = items[index];

  const replaceText = getReplaceText(textBefore, item, cursorColumn);

  // if you haven't typed into the completions yet (for example after a `.`) then
  // score items starting with non-alphabetic characters -1, everything else 0.
  if (replaceText.length === 0) return isLetter(item.label[0]) ? 0 : -1;

  // We filter items by replaceText inclusion before scoring,
  // so i is guaranteed to be an index into `item.label`...
  const i = item.label.toLowerCase().indexOf(replaceText.toLowerCase());
  // and `replaceTextInItemLabel` should be the same as `replaceText` up to upper/lowercase
  // differences.
  const replaceTextInItemLabel = item.label.slice(i, replaceText.length);

  // mostly counts how many upper/lowercase differences there are
  const diff = simpleStringDiff(replaceTextInItemLabel, replaceText);

  // `-i` scores completions better if what you typed is earlier in the completion
  // `-diff/10` mostly tie breaks that score by capitalization differences.
  return -i - diff / 10; // 10 is a magic number
};

async function getCompletions(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  textBefore: string,
  cvContext: CodeViewCompletionContext,
  behaviorContext: BehaviorContext
): Promise<monaco.languages.CompletionList | null> {

  // get completions
  const completions = await behaviorContext.pmContext.ui.codeview?.codeViewCompletions(cvContext);
  if (completions === undefined) return null;
  if (completions.items.length == 0) return null;

  const itemsHaveSortText = completions.items?.[0].sortText !== undefined;

  const items = itemsHaveSortText ?
    completions.items.sort(compareBySortText) :
    completions.items;

  // The token is the contents of the line up to your cursor.
  // For example, if you type `os.a` then token will be `os.a`.
  // Note: in contrast, when you type `os.a` replaceText will give `a` for a completion like `abc`.
  const token = textBefore.match(/\S+$/)?.[0];

  const cursorColumn = position.column;

  const filteredItems = items.filter(item => {
    // no text completions that aren't snippets
    if (item.kind === CompletionItemKind.Text &&
      item.insertTextFormat !== InsertTextFormat.Snippet) return false;

    // only allow non-text edits if we have no token
    if (item.textEdit === undefined && token) return false;

    // require at least inclusion
    const replaceText = getReplaceText(textBefore, item, cursorColumn).toLowerCase();
    return item.label.toLowerCase().includes(replaceText) ||
      item.insertText?.toLowerCase().includes(replaceText);
  });

  const boostScore = itemsHaveSortText ?
    sortTextItemsBoostScore :
    defaultBoostScore;

  // compute boosts and sort by them (highest first); monaco sorts by sortText
  // so encode the resulting rank in the sortText
  const scored = filteredItems
    .map((item, index) => ({ item, boost: boostScore(textBefore, cursorColumn, filteredItems, index), index }))
    .sort((a, b) => (b.boost - a.boost) || (a.index - b.index));

  const suggestions = scored.map(({ item }, rank): monaco.languages.CompletionItem => {
    const from = itemFromColumn(item, cursorColumn);
    const insertText = item.textEdit?.newText ?? (item.insertText || item.label);
    const replaceText = getReplaceText(textBefore, item, cursorColumn);
    return {
      label: item.label,
      kind: lsKindToMonacoKind(item.kind),
      detail: item.detail,
      documentation: documentationForItem(item),
      insertText,
      insertTextRules: item.insertTextFormat === InsertTextFormat.Snippet
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : monaco.languages.CompletionItemInsertTextRule.None,
      range: new monaco.Range(position.lineNumber, from, position.lineNumber, cursorColumn),
      sortText: String(rank).padStart(5, "0"),
      // our own filtering/ranking has already been applied, so make sure
      // monaco's filter keeps everything (it matches against filterText)
      filterText: replaceText + item.label,
      command: item.command?.command === "editor.action.triggerSuggest"
        ? { id: "editor.action.triggerSuggest", title: "" }
        : undefined
    };
  });

  // make sure the model is still the same (cell could have been deleted)
  if (model.isDisposed()) {
    return null;
  }

  return { suggestions };
}

function lsKindToMonacoKind(kind?: CompletionItemKind): monaco.languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind;
  switch (kind || CompletionItemKind.Text) {
    case CompletionItemKind.Method: return kinds.Method;
    case CompletionItemKind.Function: return kinds.Function;
    case CompletionItemKind.Constructor: return kinds.Constructor;
    case CompletionItemKind.Field: return kinds.Field;
    case CompletionItemKind.Variable: return kinds.Variable;
    case CompletionItemKind.Class: return kinds.Class;
    case CompletionItemKind.Interface: return kinds.Interface;
    case CompletionItemKind.Module: return kinds.Module;
    case CompletionItemKind.Property: return kinds.Property;
    case CompletionItemKind.Unit: return kinds.Unit;
    case CompletionItemKind.Value: return kinds.Value;
    case CompletionItemKind.Enum: return kinds.Enum;
    case CompletionItemKind.Keyword: return kinds.Keyword;
    case CompletionItemKind.Snippet: return kinds.Snippet;
    case CompletionItemKind.Color: return kinds.Color;
    case CompletionItemKind.File: return kinds.File;
    case CompletionItemKind.Reference: return kinds.Reference;
    case CompletionItemKind.Folder: return kinds.Folder;
    case CompletionItemKind.EnumMember: return kinds.EnumMember;
    case CompletionItemKind.Constant: return kinds.Constant;
    case CompletionItemKind.Struct: return kinds.Struct;
    case CompletionItemKind.Event: return kinds.Event;
    case CompletionItemKind.Operator: return kinds.Operator;
    case CompletionItemKind.TypeParameter: return kinds.TypeParameter;
    case CompletionItemKind.Text:
    default:
      return kinds.Text;
  }
}

function documentationForItem(item: CompletionItem): string | monaco.IMarkdownString | undefined {
  if (!item.documentation) {
    return undefined;
  }
  if (MarkupContent.is(item.documentation)) {
    if (item.documentation.kind === MarkupKind.Markdown) {
      return { value: item.documentation.value };
    } else {
      return item.documentation.value;
    }
  }
  return item.documentation;
}

function simpleStringDiff(str1: string, str2: string) {
  let diff = 0;
  for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
    if (str1[i] !== str2[i]) diff++;
  }
  return diff;
}

function isLetter(c: string) {
  return c.toLowerCase() != c.toUpperCase();
}

