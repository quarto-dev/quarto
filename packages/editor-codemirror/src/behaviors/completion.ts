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
  snippet 
} from "@codemirror/autocomplete"

import { 
  CompletionItem,
  InsertReplaceEdit, 
  InsertTextFormat, 
  MarkupContent, 
  MarkupKind, 
  TextEdit 
} from "vscode-languageserver-types";

import md from "markdown-it";

import { editorLanguage } from "editor-core";

import { codeViewCompletionContext } from "editor";

import { Behavior, BehaviorContext } from ".";

// TODO: types/icons
// TODO: documentation
// TODO: YAML and TeX completions
// TODO: html with < is messed up
// TODO: why doesn't R trigger on ::?

export function completionBehavior(behaviorContext: BehaviorContext) : Behavior {

  // don't provide behavior if we don't have completions
  if (!behaviorContext.pmContext.ui.completion) {
    return {
      extensions: []
    }
  }

  return {
    extensions: [
      autocompletion({
        override: [
          async (context: CompletionContext) : Promise<CompletionResult | null> => {
            
            // see if there is a completion context
            const cvContext = codeViewCompletionContext(behaviorContext.view.state);
            if (!cvContext) {
              return null;
            }

            // check if this is a known editor language
            const language = editorLanguage(cvContext.language);
            if (!language) {
              return null;
            }

            // we need to be preceded by a non space character or be explicit
            const match = context.matchBefore(/\S/);
            if (!match && !context.explicit) {
              return null;
            }

            // get completions
            const completions = await behaviorContext.pmContext.ui.completion?.codeViewCompletions(cvContext);
            if (context.aborted || !completions || completions.items.length == 0) {
              return null;
            }

            // order completions
            completions.items = completions.items.sort((a, b) => {
              if (a.sortText && b.sortText) {
                return a.sortText.localeCompare(b.sortText);
              } else {
                return a.label.localeCompare(b.label);
              }
            });    
          
            // use order to create boost
            const total = completions.items.length;
            const boostScore = (index: number) => {
              return -99 + Math.round(((total-index)/total) * 198);
            }
            // return completions
            return {
              from: context.pos,
              options: completions.items.map((item,index) : Completion => {
                return {
                  label: item.label,
                  info: () : Node | null => {
                    return infoNodeForItem(item);     
                  },
                  apply: (view: EditorView, completion: Completion, from: number) => {
                    // compute from
                    from = item.textEdit 
                      ? InsertReplaceEdit.is(item.textEdit) 
                          ? context.pos - (item.textEdit.insert.end.character - item.textEdit.insert.start.character)
                          : TextEdit.is(item.textEdit)
                              ? context.pos - (item.textEdit.range.end.character - item.textEdit.range.start.character)
                              : context.pos
                      : context.pos;
  
                    // handle snippets
                    const insertText = item.insertText || item.label;
                    if (item.insertTextFormat === InsertTextFormat.Snippet) {
                      const insertSnippet = snippet(insertText.replace(/\$(\d+)/g, "$${$1}"));
                      insertSnippet(view, completion, from, context.pos);
                    // normal completions
                    } else {
                      view.dispatch({
                        ...insertCompletionText(view.state, insertText, from, context.pos),
                        annotations: pickedCompletion.of(completion)
                      })
                    }
                  },
                  boost: boostScore(index)
                }
              })
            };
          }
        ]
      })
    ]
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
