/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface EmbeddedLanguage {
  ids: string[];
  extension: string;
  type: "content" | "tempfile";
  trigger?: string[];
  inject?: string[];
  reuseVdoc?: boolean;
}

export function embeddedLanguage(langauge: string) {
  return kEmbededLanguages.find((lang) => lang.ids.includes(langauge));
}

const kEmbededLanguages = [
  // these langauges required creatinga a temp file
  defineLanguage("python", {
    ext: "py",
    inject: ["# type: ignore", "# flake8: noqa"],
    trigger: ["."],
  }),
  defineLanguage("r", { trigger: ["$", "@", ":", "."], reuseVdoc: true }),
  defineLanguage("julia", { ext: "jl", trigger: ["."] }),
  defineLanguage("sql", { trigger: ["."] }),
  defineLanguage("bash", { ext: "sh" }),
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
    trigger: options?.trigger,
    inject: options?.inject,
    reuseVdoc: options?.reuseVdoc,
  };
}
