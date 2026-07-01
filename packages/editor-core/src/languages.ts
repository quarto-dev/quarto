/*
 * languages.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export interface EditorLanguage {
  ids: string[];
  comment?: string;
  ext?: string;
  trigger?: string[];
}

const kEditorLanguages = [
  {
    ids: ["python"],
    ext: "py",
    comment: "#",
    trigger: ["."]
  },
  {
    ids: ["r"],
    ext: "r",
    comment: "#",
    trigger: ["$", "@", ":", "."],
  },
  {
    ids: ["julia"],
    ext: "jl",
    comment: "#",
    trigger: ["."]
  },
  {
    ids: ["matlab"],
    ext: "m",
    comment: "%",
    trigger: ["."]
  },
  {
    ids: ["stata"],
    ext: "do",
    comment: "*",
    trigger: ["."]
  },
  {
    ids: ["sql"],
    comment: "--",
    trigger: ["."]
  },
  {
    ids: ["prql"],
    comment: "#",
    trigger: ["."]
  },
  {
    ids: ["bash"],
    comment: "#",
    ext: "sh"
  },
  {
    ids: ["sh"],
    comment: "#",
    ext: "sh"
  },
  {
    ids: ["shell"],
    comment: "#",
    ext: "sh"
  },
  {
    ids: ["ruby"],
    ext: "rb",
    comment: "#",
    trigger: ["."]
  },
  {
    ids: ["rust"],
    ext: "rs",
    comment: "//",
    trigger: ["."]
  },
  {
    ids: ["java"],
    comment: "//",
    trigger: ["."]
  },
  {
    ids: ["cpp"],
    comment: "//",
    trigger: [".", ">", ":"]
  },
  {
    ids: ["go"],
    comment: "//",
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
    comment: "//",
    ext: "ts",
    trigger: ["."],
  },
  {
    ids: ["js", "javascript", "d3", "ojs"],
    comment: "//",
    ext: "js",
    trigger: ["."],
  },
  {
    ids: ["jsx"],
    comment: "//",
    trigger: ["."]
  },
  {
    ids: ["yaml"],
    ext: "yml"
  }
];

export function editorLanguage(id: string) {
  id = id.split("-").pop() || "";
  return kEditorLanguages.find((lang) => lang.ids.includes(id));
}

export function languageDiagramEngine(id: string) {
  if (id === "dot") {
    return "graphviz";
  } else if (id === "mermaid") {
    return "mermaid";
  } else {
    return undefined;
  }
}