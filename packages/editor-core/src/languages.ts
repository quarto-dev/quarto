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

export interface EditorLanguage {
  ids: string[];
  ext?: string;
  trigger?: string[];
}

const kEditorLanguages = [
  {
    ids: ["python"],
    ext: "py",
    trigger: ["."]
  },
  {
    ids: ["r"],
    ext: "r",
    trigger: ["$", "@", ":", "."],
  },
  {
    ids: ["julia"],
    ext: "jl",
    trigger: ["."]
  },
  {
    ids: ["sql"],
    trigger: ["."]
  },
  {
    ids: ["bash"],
    ext: "sh"
  },
  {
    ids: ["sh"],
    ext: "sh"
  },
  {
    ids: ["shell"],
    ext: "sh"
  },
  {
    ids: ["ruby"],
    ext: "rb",
    trigger: ["."]
  },
  {
    ids: ["rust"],
    ext: "rs",
    trigger: ["."]
  },
  {
    ids: ["java"],
    trigger: ["."]
  },
  {
    ids: ["cpp"],
    trigger: [".", ">", ":"]
  },
  {
    ids: ["go"],
    trigger: ["."]
  },
  {
    ids: ["html"]
  },
  {
    ids: ["css"]
  },
  {
    ids: ["ts", "typescript"],
    ext: "ts",
    trigger: ["."],
  },
  {
    ids: ["js", "javascript", "d3", "ojs"],
    ext: "js",
    trigger: ["."],
  },
  {
    ids: ["jsx"],
    trigger: ["."]
  },
  {
    ids: ["yaml"],
    ext: "yml"
  }
];

export function editorLanguage(id: string) {
  return kEditorLanguages.find((lang) => lang.ids.includes(id));
}