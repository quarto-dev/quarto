/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import * as yaml from "js-yaml";
import * as fs from "fs";

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  Range,
  TextEdit,
} from "vscode-languageserver/node";
import { EditorContext } from "./quarto";

export const kContextHeading = "heading";
export const kContextDiv = "div";
export const kContextDivSimple = "div-simple";
export const kContextCodeblock = "codeblock";
export const kContextFigure = "figure";

export type AttrContext =
  | "heading"
  | "div"
  | "div-simple"
  | "codeblock"
  | "figure";

export interface AttrToken {
  context: AttrContext;
  formats: string[];
  attr: string;
  token: string;
}

interface Attr {
  contexts: AttrContext[];
  formats: string[];
  filter?: RegExp;
  value: string;
  doc?: string;
  sortText?: string;
}

interface AttrGroup {
  group: string;
  contexts: AttrContext[];
  formats?: string[];
  filter?: RegExp;
  completions: AttrCompletion[];
}

interface AttrCompletion {
  value: string;
  doc?: string;
}

// cache array of Attr
const attrs: Attr[] = [];

export function initializeAttrCompletionProvider(resourcesPath: string) {
  // read attr.yml from resources
  const attrYamlPath = path.join(resourcesPath, "editor", "tools", "attrs.yml");
  try {
    const attrGroups = yaml.load(
      fs.readFileSync(attrYamlPath, "utf-8")
    ) as AttrGroup[];
    for (const group of attrGroups) {
      const filter = group.filter ? new RegExp(group.filter) : undefined;
      group.completions.forEach((completion, index) => {
        const attr: Attr = {
          contexts: group.contexts,
          formats: group.formats || [],
          filter,
          ...completion,
        };
        attr.sortText = group.group + "-" + String.fromCharCode(65 + index);
        attrs.push(attr);
      });
    }
  } catch (error) {
    console.log(error);
  }

  return async (
    token: AttrToken,
    context: EditorContext
  ): Promise<CompletionItem[]> => {
    const simpleDiv = token.context === kContextDivSimple;
    token.context =
      token.context === kContextDivSimple ? kContextDiv : token.context;
    const completions: CompletionItem[] = attrs
      .filter((attr) => {
        if (attr.filter && !token.attr.match(attr.filter)) {
          // check filter
          return false;
        } else if (
          attr.formats.length > 0 &&
          !attr.formats.some((format) => context.formats.includes(format))
        ) {
          // check formats
          return false;
        } else if (!attr.contexts.includes(token.context)) {
          // check context
          return false;
        } else {
          const value = normalizedValue(attr.value, simpleDiv);
          return value.startsWith(token.token);
        }
      })
      .map((attr) => {
        // remove leading . if this is a simple div
        const value = normalizedValue(attr.value, simpleDiv);

        // handle inserting cursor between ending quotes
        const quotes = value.endsWith('""');

        const edit = TextEdit.replace(
          Range.create(
            context.position.row,
            context.position.column - token.token.length,
            context.position.row,
            context.position.column
          ),
          value
        );
        const item: CompletionItem = {
          label: value.replace('="$0"', "").replace("$0", ""),
          kind: CompletionItemKind.Field,
          textEdit: edit,
          insertTextFormat: InsertTextFormat.Snippet,
          sortText: attr.sortText,
        };
        if (attr.doc) {
          item.documentation = { kind: MarkupKind.Markdown, value: attr.doc };
        }
        return item;
      });

    return completions;
  };
}

function normalizedValue(value: string, simpleDiv: boolean) {
  return simpleDiv && value.startsWith(".") ? value.slice(1) : value;
}
