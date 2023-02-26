/*
 * completion.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */


import { EditorView } from "@codemirror/view";


import { 
  autocompletion, 
  Completion, 
  CompletionContext, 
  CompletionResult, 
  insertCompletionText, 
  pickedCompletion, 
  snippet, 
  startCompletion
} from "@codemirror/autocomplete"

import { 
  CompletionItem,
  CompletionItemKind,
  InsertReplaceEdit, 
  InsertTextFormat, 
  MarkupContent, 
  MarkupKind, 
  TextEdit 
} from "vscode-languageserver-types";

import md from "markdown-it";

import { editorLanguage } from "editor-core";

import { CodeViewCompletionContext, codeViewCompletionContext } from "editor";

import { Behavior, BehaviorContext } from ".";
import { escapeRegExpCharacters } from "core";

export function completionBehavior(behaviorContext: BehaviorContext) : Behavior {

  // don't provide behavior if we don't have completions
  if (!behaviorContext.pmContext.ui.codeview) {
    return {}
  }

  return {
    extensions: [
      autocompletion({
        closeOnBlur: true,
        override: [
          async (context: CompletionContext) : Promise<CompletionResult | null> => {

            // no completions if there is no path
            const filepath = behaviorContext.pmContext.ui.context.getDocumentPath();
            if (!filepath) {
              return null;
            }

            // see if there is a completion context
            const cvContext = codeViewCompletionContext(filepath, behaviorContext.view.state, context.explicit);
            if (!cvContext) {
              return null;
            }

            // check if this is a known editor language
            const language = editorLanguage(cvContext.language);
            if (!language) {
              return null;
            }

            // if we don't have quick suggestions enabled and this isn't explicit then bail
            if (!behaviorContext.pmContext.ui.prefs.quickSuggestions() && !context.explicit) {
              return null;
            }

            // if we aren't explcit then filter based on match (letter + wordchar + optional trigger chars)
            if (!context.explicit) {
              const trigger = (language.trigger || ["."]);
              const match = context.matchBefore(new RegExp('(^|[ \t])[A-Za-z_\\.][\\w_\\(\\)\\[\\]' +  escapeRegExpCharacters(trigger.join('')) + ']*'));
              if (!match) {
                return null;
              }
            }

            // get completions
            return getCompletions(context, cvContext, behaviorContext);
          }
        ]
      })
    ]
  }
}

async function getCompletions(
  context: CompletionContext,
  cvContext: CodeViewCompletionContext,
  behaviorContext: BehaviorContext
) : Promise<CompletionResult | null> {

  // get completions
  const completions = await behaviorContext.pmContext.ui.codeview?.codeViewCompletions(cvContext);
  if (context.aborted || !completions || completions.items.length == 0) {
    return null;
  }

  // order completions
  const haveOrder = !!completions.items?.[0].sortText;
  if (haveOrder) {
    completions.items = completions.items.sort((a, b) => {
      if (a.sortText && b.sortText) {
        return a.sortText.localeCompare(b.sortText);
      } else {
        return 0;
      }
    });  
  }

  // compute token
  const token = context.matchBefore(/\S+/)?.text;

  // compute from
  const itemFrom = (item: CompletionItem) => {
      // compute from
      return item.textEdit 
      ? InsertReplaceEdit.is(item.textEdit) 
          ? context.pos - (item.textEdit.insert.end.character - item.textEdit.insert.start.character)
          : TextEdit.is(item.textEdit)
              ? context.pos - (item.textEdit.range.end.character - item.textEdit.range.start.character)
              : context.pos
      : context.pos;
  }

  // use order to create boost
  const total = completions.items.length;
  const boostScore = (index: number) => {

    // compute replaceText
    const item = completions.items[index];
    const replaceText = context.state.sliceDoc(itemFrom(item), context.pos).toLowerCase();

    if (haveOrder) {
      
      // if the replaceText doesn't start with "." then bury items that do
      if (!replaceText.startsWith(".") && item.label.startsWith(".")) {
        return -99;
      }

      // only boost things that have a prefix match
      if (item.label.toLowerCase().startsWith(replaceText) ||
         (item.textEdit && item.textEdit.newText.toLowerCase().startsWith(replaceText)) ||
         (item.insertText && item.insertText.toLowerCase().startsWith(replaceText))) {
        return -99 + Math.round(((total-index)/total) * 198);;
      } else {
        return -99;
      }

    } else {
      return undefined;
    }
  }

  // return completions
  return {
    from: context.pos,
    
    options: completions.items
      .filter(item => {
        
        // no text completions that aren't snippets
        if (item.kind === CompletionItemKind.Text &&
            item.insertTextFormat !== InsertTextFormat.Snippet) {
          return false;
        }
          
        // compute text to replace
        const replaceText = context.state.sliceDoc(itemFrom(item), context.pos).toLowerCase();

        // only allow non-text edits if we have no token
        if (!item.textEdit && token) {
          return false;
        }
       
        // require at least inclusion
        return item.label.toLowerCase().includes(replaceText) ||
                (item.insertText && item.insertText.toLowerCase().includes(replaceText));
      })
      .map((item,index) : Completion => {
        return {
          label: item.label,
          detail: item.detail && !item.documentation ? item.detail : undefined,
          type: vsKindToType(item.kind),
          info: () : Node | null => {
            if (item.documentation) {
              return infoNodeForItem(item);   
            } else {
              return null;
            }
          },
          apply: (view: EditorView, completion: Completion, from: number) => {
            // compute from
            from = itemFrom(item);

            // handle snippets
            const insertText = item.textEdit?.newText ?? (item.insertText || item.label);
            if (item.insertTextFormat === InsertTextFormat.Snippet) {
              const insertSnippet = snippet(insertText.replace(/\$(\d+)/g, "$${$1}"));
              insertSnippet(view, completion, from, context.pos);
            // normal completions
            } else {
              view.dispatch({
                ...insertCompletionText(view.state, insertText, from, context.pos),
                annotations: pickedCompletion.of(completion)
              })
              if (item.command?.command === "editor.action.triggerSuggest") {
                startCompletion(view);
              }
            }
          },
          boost: boostScore(index)
        }
      })
  };
}


function vsKindToType(kind?: CompletionItemKind) {
  kind = kind || CompletionItemKind.Text;
  switch(kind) {
    case CompletionItemKind.Method:
    case CompletionItemKind.Constructor: 
      return "method";
    case CompletionItemKind.Function:
      return "function";
    case CompletionItemKind.Field: 
    case CompletionItemKind.Property:
    case CompletionItemKind.Event:
      return "property";
    case CompletionItemKind.Variable:
    case CompletionItemKind.Reference:
      return "variable";
    case CompletionItemKind.Class:
    case CompletionItemKind.Struct:
      return "class";
    case CompletionItemKind.Interface:
      return "interface";
    case CompletionItemKind.Module:
    case CompletionItemKind.Unit:
    case CompletionItemKind.File:
    case CompletionItemKind.Folder:
      return "namespace";
    case CompletionItemKind.Value: 
    case CompletionItemKind.Constant:
      return "constant";
    case CompletionItemKind.Enum: 
    case CompletionItemKind.EnumMember:
      return "enum";
    case CompletionItemKind.Keyword: 
      return "keyword";
    case CompletionItemKind.TypeParameter:
      return "type";

    case CompletionItemKind.Text:
    case CompletionItemKind.Snippet: 
    case CompletionItemKind.Color:
    case CompletionItemKind.Operator:
    default:
      return "text"; 
  }
}


function infoNodeForItem(item: CompletionItem) {

  const headerEl = (text: string, tag: string) => {
    const header = document.createElement(tag);
    header.classList.add("cm-completionInfoHeader");
    header.innerText = text;
    return header;
  }
  const textDiv = (text: string) => {
    const span = document.createElement("div");
    span.innerText = text;
    return span;
  }
  
  if (item.detail && !item.documentation) {
    return headerEl(item.detail, "span");
  } else if (item.documentation) {
    const infoDiv = document.createElement("div");
    if (item.detail) {
      infoDiv.appendChild(headerEl(item.detail, "p"));
    }
    if (MarkupContent.is(item.documentation)) {
      if (item.documentation.kind === MarkupKind.Markdown) {
        const commonmark = md('commonmark');
        const html = commonmark.render(item.documentation.value);
        const mdDiv = document.createElement("div");
        mdDiv.innerHTML = html;
        // remove mdn links
        mdDiv.querySelectorAll("p").forEach(paraEl => {
          if (paraEl.childElementCount === 1 && 
              paraEl.firstElementChild?.tagName === "A") {
            paraEl.parentElement?.removeChild(paraEl);
          }
        });
        
       
        infoDiv.appendChild(mdDiv);
      } else {
        infoDiv.appendChild(textDiv(item.documentation.value));
      }
    } else {
      infoDiv.appendChild(textDiv(item.documentation));
    }
    return infoDiv;
  } else {
    return null;
  }                    
}
