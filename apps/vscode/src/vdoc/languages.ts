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

export interface EmbeddedLanguage {
  ids: string[];
  extension: string;
  type: "content" | "tempfile";
  emptyLine?: string
  trigger?: string[];
  inject?: string[];
  reuseVdoc?: boolean;
}

export function embeddedLanguage(langauge: string) {
  return kEmbededLanguages.find((lang) => lang.ids.includes(langauge));
}

const kEmbededLanguages = [
  // these langauges required creating a temp file
  defineLanguage("python", {
    ext: "py",
    inject: ["# type: ignore", "# flake8: noqa"],
    trigger: ["."],
    emptyLine: "#",
  }),
  defineLanguage("r", { trigger: ["$", "@", ":", "."], reuseVdoc: true }),
  defineLanguage("julia", { ext: "jl", trigger: ["."] }),
  defineLanguage("sql", { trigger: ["."] }),
  defineLanguage("bash", { ext: "sh" }),
  defineLanguage("sh", { ext: "sh" }),
  defineLanguage("shell", { ext: "sh" }),   
  defineLanguage("ruby", { ext: "rb", trigger: ["."] }),
  defineLanguage("rust", { ext: "rs", trigger: ["."] }),
  defineLanguage("java", { trigger: ["."] }),
  defineLanguage(["cpp"], { trigger: [".", ">", ":"] }),
  defineLanguage("go", { trigger: ["."] }),
  // these langauges work w/ text document content provider
  defineLanguage("html", { type: "content" }),
  defineLanguage("css", { type: "content" }),
  defineLanguage(["ts", "typescript"], {
    ext: "ts",
    type: "content",
    trigger: ["."],
  }),
  defineLanguage(["js", "javascript", "d3", "ojs"], {
    ext: "js",
    type: "content",
    trigger: ["."],
  }),
  defineLanguage("jsx", { trigger: ["."], type: "content" }),
];

interface LanguageOptions {
  ext?: string;
  type?: "content" | "tempfile";
  emptyLine?: string;
  trigger?: string[];
  inject?: string[];
  reuseVdoc?: boolean;
}

function defineLanguage(
  language: string | string[],
  options?: LanguageOptions
): EmbeddedLanguage {
  language = Array.isArray(language) ? language : [language];
  return {
    ids: language,
    extension: options?.ext || language[0],
    type: options?.type || "tempfile",
    emptyLine: options?.emptyLine,
    trigger: options?.trigger,
    inject: options?.inject,
    reuseVdoc: options?.reuseVdoc,
  };
}
