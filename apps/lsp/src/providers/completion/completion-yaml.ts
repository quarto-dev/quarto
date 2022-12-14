/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Range, TextEdit } from "vscode-languageserver-types";

import {
  Command,
  CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver/node";

import { EditorContext, quarto } from "../../quarto/quarto";

export async function yamlCompletions(context: EditorContext) {
  // bail if no quarto connection
  if (!quarto) {
    return null;
  }

  // get completions
  const result = await quarto.getYamlCompletions(context);
  if (result) {
    // if there is one completion and it matches the token
    // then don't return it
    if (
      result.completions.length === 1 &&
      result.token === result.completions[0].value
    ) {
      return null;
    }

    // mqp our completions to vscode completions
    return result.completions.map((completion) => {
      const completionWord = completion.value.replace(/: $/, "");
      const item: CompletionItem = {
        label: completionWord,
        kind: CompletionItemKind.Field,
      };
      // strip tags from description
      if (completion.description) {
        item.documentation = decodeEntities(
          completion.description
            .replace(/(<([^>]+)>)/gi, "")
            .replace(/\n/g, " ")
        );
      }
      if (result.token.length > 0 && completionWord.startsWith(result.token)) {
        const edit = TextEdit.replace(
          Range.create(
            context.position.row,
            context.position.column - result.token.length,
            context.position.row,
            context.position.column
          ),
          completion.value
        );
        item.textEdit = edit;
      } else {
        item.insertText = completion.value;
      }

      if (completion.suggest_on_accept) {
        item.command = Command.create(
          "Suggest",
          "editor.action.triggerSuggest"
        );
      }
      return item;
    });
  } else {
    return null;
  }
}

function decodeEntities(encodedString: string) {
  var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
  var translate: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    lt: "<",
    gt: ">",
  };
  return encodedString
    .replace(translate_re, function (_match, entity: string) {
      return translate[entity];
    })
    .replace(/&#(\d+);/gi, function (_match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}
