/*
 * languages.ts
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

import { editorLanguage } from "editor-core";

export interface EmbeddedLanguage {
  ids: string[];
  extension: string;
  type: "content" | "tempfile";
  emptyLine?: string;
  trigger?: string[];
  inject?: string[];
  reuseVdoc?: boolean;
  canFormat?: boolean;
}

export function embeddedLanguage(langauge: string) {
  return kEmbededLanguages.find((lang) => lang.ids.includes(langauge));
}

const kEmbededLanguages = [
  // these langauges required creating a temp file
  defineLanguage("python", {
    inject: ["# type: ignore", "# flake8: noqa"],
    emptyLine: "#",
    canFormat: true,
  }),
  defineLanguage("r", {
    emptyLine: "#",
    reuseVdoc: true,
    canFormat: true,
  }),
  defineLanguage("julia", {
    emptyLine: "#",
    canFormat: true,
  }),
  defineLanguage("sql"),
  defineLanguage("bash"),
  defineLanguage("sh"),
  defineLanguage("shell"),
  defineLanguage("ruby"),
  defineLanguage("rust"),
  defineLanguage("java"),
  defineLanguage("cpp"),
  defineLanguage("go"),
  // these langauges work w/ text document content provider
  defineLanguage("html", { type: "content" }),
  defineLanguage("css", { type: "content" }),
  defineLanguage("typescript", { type: "content"}),
  defineLanguage("javascript", { type: "content" }),
  defineLanguage("jsx", { type: "content" }),
];

interface LanguageOptions {
  type?: "content" | "tempfile";
  emptyLine?: string;
  inject?: string[];
  reuseVdoc?: boolean;
  canFormat?: boolean;
}

function defineLanguage(
  id: string,
  options?: LanguageOptions
): EmbeddedLanguage {
 
  // lookup langauge
  const language = editorLanguage(id);
  if (!language) {
    throw new Error(`Unknown language ${id}`);
  }

  // validate consistency of options
  if (options?.canFormat && !options?.emptyLine) {
    throw new Error(
      "emptyLine must be specified for languages with canFormat === true"
    );
  }
  return {
    ids: language.ids,
    extension: language.ext || language.ids[0],
    type: options?.type || "tempfile",
    emptyLine: options?.emptyLine,
    trigger: language.trigger,
    inject: options?.inject,
    reuseVdoc: options?.reuseVdoc,
    canFormat: options?.canFormat,
  };
}
