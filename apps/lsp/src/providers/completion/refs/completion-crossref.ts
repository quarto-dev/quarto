/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { ExecFileSyncOptions } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
tmp.setGracefulCleanup();

import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";
import { quartoProjectConfig } from "../../../shared/metadata";
import { pathWithForwardSlashes } from "../../../shared/path";

import { quarto } from "../../../quarto/quarto";
import { fileCrossrefIndexStorage } from "../../../shared/storage";

export async function crossrefCompletions(
  token: string,
  code: string,
  filePath: string,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  // first get the index for the source code
  const srcXRefs = indexSourceFile(
    code,
    projectDir
      ? projectRelativeInput(projectDir, filePath)
      : path.basename(filePath)
  );

  // now get the paths to project xref indexes (if any)
  const projectXRefIndex = projectDir
    ? projectXrefIndex(projectDir)
    : new Map<string, string>();

  // now get the rendered index for this file and ammend w/ computations
  const renderedXrefs = projectDir
    ? readXRefIndex(
        projectXRefIndexPath(projectXRefIndex, projectDir, filePath),
        path.relative(projectDir, filePath)
      )
    : readXRefIndex(
        fileCrossrefIndexStorage(filePath),
        path.basename(filePath)
      );
  const xrefs: XRef[] = [...srcXRefs];
  for (const renderedXref of renderedXrefs) {
    // computational ref
    if (
      (renderedXref[kType] === kFigType || renderedXref[kType] === kTblType) &&
      renderedXref[kSuffix]
    ) {
      // copy if we have a match in src
      if (
        srcXRefs.find(
          (srcXref) =>
            srcXref[kType] === renderedXref[kType] &&
            srcXref[kId] === renderedXref[kId] &&
            !srcXref[kSuffix]
        )
      ) {
        xrefs.push(renderedXref);
      }
    }
  }

  // if this is a book then ammend with the full index (save for this file
  // which we've already indexed
  if (projectDir && quarto) {
    const config = await quartoProjectConfig(quarto.runQuarto, projectDir);
    if (config?.config.project.type === "book") {
      const input = projectRelativeInput(projectDir, filePath);
      for (const projInput of projectXRefIndex.keys()) {
        if (projInput !== input) {
          xrefs.push(
            ...readXRefIndex(projectXRefIndex.get(projInput)!, projInput)
          );
        }
      }
    }
  }

  return xrefs
    .map(xrefCompletion(!!projectDir))
    .filter((ref) => ref.label.startsWith(token));
}

type ProjectXRefIndex = Record<string, Record<string, string>>;

function projectRelativeInput(projectDir: string, filePath: string) {
  return pathWithForwardSlashes(path.relative(projectDir, filePath));
}

function projectXRefIndexPath(
  xrefIndex: Map<string, string>,
  projectDir: string,
  filePath: string
) {
  // ensure that our lookup key is correct
  const input = projectRelativeInput(projectDir, filePath);

  // do the lookup
  return xrefIndex.get(input);
}

function projectXrefIndex(projectDir: string): Map<string, string> {
  const mainIndex = new Map<string, string>();
  const projectXRefDir = path.join(projectDir, ".quarto", "xref");
  const projectXRefIndex = path.join(projectXRefDir, "INDEX");
  if (fs.existsSync(projectXRefIndex)) {
    // read index
    const index = JSON.parse(
      fs.readFileSync(projectXRefIndex, { encoding: "utf-8" })
    ) as ProjectXRefIndex;

    for (const input of Object.keys(index)) {
      // ensure the input actually exists
      if (fs.existsSync(path.join(projectDir, input))) {
        // pick the most recently written output
        for (const output of Object.values(index[input])) {
          const outputXref = path.join(projectXRefDir, output);
          if (fs.existsSync(outputXref)) {
            if (mainIndex.has(input)) {
              if (
                fs.statSync(outputXref).mtimeMs >
                fs.statSync(mainIndex.get(input)!).mtimeMs
              ) {
                mainIndex.set(input, outputXref);
              }
            } else {
              mainIndex.set(input, outputXref);
            }
          }
        }
      }
    }
  }
  return mainIndex;
}

const kFile = "file";
const kType = "type";
const kId = "id";
const kSuffix = "suffix";
const kTitle = "title";
const kFigType = "fig";
const kTblType = "tbl";

type XRef = {
  [kFile]: string;
  [kType]: string;
  [kId]: string;
  [kSuffix]: string;
  [kTitle]: string;
};

let xrefIndexingDir: string | undefined;

function indexSourceFile(code: string, filename: string): XRef[] {
  // setup the indexing dir if we need to
  if (!xrefIndexingDir) {
    // create dir
    xrefIndexingDir = tmp.dirSync().name;

    // write defaults file
    const defaultsFile = path.join(xrefIndexingDir, "defaults.yml");
    const filtersPath = path.join(quarto!.resourcePath, "filters");
    const defaults = `
from: markdown
to: native
data-dir: "${pathWithForwardSlashes(
      path.join(quarto!.resourcePath, "pandoc", "datadir")
    )}"
filters:
  - "${pathWithForwardSlashes(
    path.join(filtersPath, "quarto-init", "quarto-init.lua")
  )}"
  - "${pathWithForwardSlashes(
    path.join(filtersPath, "crossref", "crossref.lua")
  )}"    
`;
    fs.writeFileSync(defaultsFile, defaults, { encoding: "utf-8" });
  }

  // create filter params
  const filterParams = Buffer.from(
    JSON.stringify({
      ["crossref-index-file"]: "index.json",
      ["crossref-input-type"]: "qmd",
    }),
    "utf8"
  ).toString("base64");

  // setup options for calling pandoc
  const options: ExecFileSyncOptions = {
    input: code,
    cwd: xrefIndexingDir,
    env: {
      QUARTO_FILTER_PARAMS: filterParams,
      QUARTO_SHARE_PATH: quarto!.resourcePath,
    },
  };

  // call pandoc
  const result = quarto!.runPandoc(options, "--defaults", "defaults.yml");
  if (result) {
    return readXRefIndex(path.join(xrefIndexingDir, "index.json"), filename);
  } else {
    return [];
  }
}

function readXRefIndex(indexPath: string | undefined, filename: string) {
  const xrefs: XRef[] = [];
  if (indexPath && fs.existsSync(indexPath)) {
    const indexJson = fs.readFileSync(indexPath, { encoding: "utf-8" });
    const index = JSON.parse(indexJson) as {
      entries: Array<{ key: string; caption?: string }>;
    };
    for (const entry of index.entries) {
      const match = entry.key.match(/^(\w+)-(.*?)(-\d+)?$/);
      if (match) {
        xrefs.push({
          [kFile]: filename,
          [kType]: match[1],
          [kId]: match[2],
          [kSuffix]: match[3] || "",
          [kTitle]: entry.caption || "",
        });
      }
    }
  }
  return xrefs;
}

function xrefCompletion(includeFilename: boolean) {
  return (xref: XRef): CompletionItem => ({
    kind: CompletionItemKind.Function,
    label: `${xref[kType]}-${xref.id}${xref[kSuffix] || ""}`,
    documentation: xref[kTitle]
      ? {
          kind: MarkupKind.Markdown,
          value:
            xref[kTitle] + (includeFilename ? " — _" + xref[kFile] + "_" : ""),
        }
      : undefined,
  });
}
