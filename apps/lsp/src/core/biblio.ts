/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";
import * as tmp from "tmp";
tmp.setGracefulCleanup();

import * as yaml from "js-yaml";

import { quarto } from "../quarto/quarto";
import { shQuote } from "../shared/strings";
import {
  metadataFilesForDocument,
  projectDirForDocument,
} from "../shared/metadata";
import { filePathForDoc } from "./doc";
import { TextDocument } from "vscode-languageserver-textdocument";
import { documentFrontMatter } from "./markdown/markdown";
import { pathWithForwardSlashes } from "../shared/path";

export type CslRef = {
  id: string;
  cite?: string;
};

export function biblioRefs(doc: TextDocument): CslRef[] | null {
  const docPath = filePathForDoc(doc);
  const projectDir = projectDirForDocument(docPath);
  const frontMatter = documentFrontMatter(doc);

  // bibliography in document metadata
  const biblioOptions = bibliographyOptions(path.dirname(docPath), frontMatter);

  // bibliographies from project/dir level metadata
  if (projectDir) {
    const metadataFiles = metadataFilesForDocument(docPath);
    if (metadataFiles) {
      metadataFiles.forEach((file) => {
        const fileOptions = biblioOptionsFromMetadataFile(file);
        biblioOptions.bibliographies.push(...fileOptions.bibliographies);
        biblioOptions.csl = biblioOptions.csl || fileOptions.csl;
      });
    }
  }

  if (biblioOptions.bibliographies.length > 0) {
    const cslRefs = biblioOptions.bibliographies.reduce((refs, file) => {
      const bibFile = biblioFile(file, biblioOptions.csl);
      if (bibFile) {
        refs.push(
          ...bibFile.refs.filter((ref) => !refs.find((x) => x.id === ref.id))
        );
      }
      return refs;
    }, new Array<CslRef>());
    return cslRefs;
  } else {
    return null;
  }
}

type BiblioOptions = {
  bibliographies: string[];
  csl?: string;
};

type BiblioFile = {
  path: string;
  cached: number;
  refs: CslRef[];
};

// cache of biblio files
const biblioFiles = new Map<string, BiblioFile>();

function biblioFile(path: string, csl?: string) {
  // check cache
  const mtimeMs = fs.statSync(path).mtimeMs;
  if (
    quarto &&
    (!biblioFiles.has(path) || (biblioFiles.get(path)?.cached || 0) < mtimeMs)
  ) {
    // call pandoc to get refs
    const refs: CslRef[] = [];

    // create a temp file used as a target document for rendering citations
    const tmpDocPath = tmp.tmpNameSync();
    const tempDoc = [
      "---",
      `bibliography: "${pathWithForwardSlashes(path)}"`,
      `nocite: "@*"`,
    ];
    if (csl) {
      tempDoc.push(`csl: "${pathWithForwardSlashes(csl)}"`);
    }
    tempDoc.push("---\n");
    fs.writeFileSync(tmpDocPath, tempDoc.join("\n"), { encoding: "utf-8" });
    try {
      const output = quarto.runPandoc(
        {},
        shQuote(tmpDocPath),
        "--from",
        "markdown",
        "--to",
        "gfm",
        "--citeproc"
      );
      // update cache
      biblioFiles.set(path, {
        path,
        cached: mtimeMs,
        refs: parseCslRefs(output),
      });
    } catch (err) {
      console.log("Error reading bibliography:");
      console.error(err);
    }
  }
  return biblioFiles.get(path);
}

function parseCslRefs(output: string): CslRef[] {
  const refs: CslRef[] = [];
  let pendingId: string | undefined;
  let pendingCite: string[] = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/<div id="ref-([^"]+)"/);
    if (match) {
      pendingId = match[1];
    } else if (pendingId) {
      if (line.match(/<\/div>/)) {
        refs.push({
          id: pendingId,
          cite: pendingCite.join("\n").trim(),
        });
        pendingId = undefined;
        pendingCite = [];
      } else {
        pendingCite.push(line);
      }
    }
  }
  return refs;
}

function biblioOptionsFromMetadataFile(file: string): BiblioOptions {
  const yamlSrc = fs.readFileSync(file, "utf-8");
  try {
    if (yamlSrc.trim().length > 0) {
      const yamlOpts = yaml.load(yamlSrc) as Record<string, unknown>;
      return bibliographyOptions(path.dirname(file), yamlOpts);
    }
  } catch (err) {
    console.error(err);
  }
  return {
    bibliographies: [],
  };
}

function bibliographyOptions(
  dir: string,
  options: Record<string, unknown>
): BiblioOptions {
  const readBibliographyOption = () => {
    const option = options["bibliography"];
    if (typeof option === "string") {
      return [option];
    } else if (Array.isArray(option)) {
      return option.map((value) => String(value));
    } else {
      return [];
    }
  };
  const readCsl = () => {
    const csl = options["csl"];
    return typeof csl === "string" ? csl : undefined;
  };
  return {
    bibliographies: normalizeOptions(dir, readBibliographyOption()) || [],
    csl: normalizeOptions(dir, readCsl())?.[0],
  };
}

function normalizeOptions(dir: string, files?: string | string[]) {
  if (files) {
    files = typeof files === "string" ? [files] : files;
    return files
      .map((file) => path.normalize(path.join(dir, file)))
      .filter(fs.existsSync);
  } else {
    return undefined;
  }
}
