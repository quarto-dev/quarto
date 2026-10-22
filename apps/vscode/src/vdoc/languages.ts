/*
 * languages.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { editorLanguage } from "editor-core";

export interface EmbeddedLanguage {
  ids: string[];
  extension: string;
  type: "content" | "tempfile";
  localTempFile?: boolean;
  emptyLine?: string;
  comment?: string;
  trigger?: string[];
  /**
   * Lines of code to inject at the top of the virtual document.
   * Used to add lines that hint to language LSPs to disable diagnostics for virtual documents that were
   * created for non-diagnostic actions.
   */
  inject?: string[];
  /**
   * Comment out IPython magics (`%`, `%%`) and shell escapes (`!`) in the
   * virtual document so they don't produce spurious diagnostics from language
   * servers. Applies to IPython-flavored languages such as Python.
   */
  commentMagics?: boolean;
  canFormat?: boolean;
  canFormatDocument?: boolean;
}

export function embeddedLanguage(language: string) {
  language = language.split("-").pop() || "";
  return kEmbededLanguages.find((lang) => lang.ids.includes(language));
}

export function languageCanFormatDocument(language: EmbeddedLanguage) {
  return language.canFormatDocument !== false;
}

const kEmbededLanguages = [
  // these languages required creating a temp file
  defineLanguage("python", {
    inject: ["# type: ignore", "# flake8: noqa"],
    emptyLine: "#",
    commentMagics: true,
    canFormat: true,
    canFormatDocument: false,
  }),
  defineLanguage("r", {
    emptyLine: "#",
    canFormat: true
  }),
  defineLanguage("julia", {
    emptyLine: "#",
    canFormat: true,
  }),
  defineLanguage("matlab", {
    emptyLine: "%",
    canFormat: true
  }),
  defineLanguage("stata", {
    emptyLine: "*",
  }),
  defineLanguage("typescript", {
    type: "tempfile",
    localTempFile: true,
    inject: ["// deno-lint-ignore-file"],
    emptyLine: "//",
    canFormat: true,
  }),
  defineLanguage("sql"),
  defineLanguage("bash"),
  defineLanguage("sh"),
  defineLanguage("shell"),
  defineLanguage("ruby"),
  defineLanguage("prql"),
  defineLanguage("rust"),
  defineLanguage("java"),
  defineLanguage("cpp"),
  defineLanguage("go"),
  // these languages work w/ text document content provider
  defineLanguage("html", { type: "content" }),
  defineLanguage("css", { type: "content" }),
  defineLanguage("javascript", { type: "content" }),
  defineLanguage("jsx", { type: "content" }),
];

interface LanguageOptions {
  type?: "content" | "tempfile";
  localTempFile?: boolean;
  emptyLine?: string;
  /**
   * Lines of code to inject at the top of the virtual document.
   * Used to add lines that hint to language LSPs to disable diagnostics for virtual documents that were
   * created for non-diagnostic actions.
   */
  inject?: string[];
  /**
   * Comment out IPython magics (`%`, `%%`) and shell escapes (`!`) in the
   * virtual document so they don't produce spurious diagnostics from language
   * servers. Applies to IPython-flavored languages such as Python.
   */
  commentMagics?: boolean;
  canFormat?: boolean;
  canFormatDocument?: boolean;
}

function defineLanguage(
  id: string,
  options?: LanguageOptions
): EmbeddedLanguage {

  // lookup language
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
    localTempFile: options?.localTempFile,
    comment: language.comment,
    emptyLine: options?.emptyLine,
    trigger: language.trigger,
    inject: options?.inject,
    commentMagics: options?.commentMagics,
    canFormat: options?.canFormat,
    canFormatDocument: options?.canFormatDocument
  };
}
