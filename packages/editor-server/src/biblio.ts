/*
 * biblio.ts
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

import path from "path";
import fs from "fs";
import * as tmp from "tmp";
tmp.setGracefulCleanup();

import * as yaml from "js-yaml";

import { shQuote, pathWithForwardSlashes } from "core";
import {
  metadataFilesForDocument,
  projectDirForDocument,
  QuartoContext,
} from "quarto-core";


export type CslRef = {
  id: string;
  cite?: string;
};

export async function biblioRefs(
  quarto: QuartoContext,
  docPath: string, 
  frontMatter: Record<string,unknown>
): Promise<CslRef[] | null> {

  const projectDir = projectDirForDocument(docPath);

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
      const bibFile = biblioFile(quarto, file, biblioOptions.csl);
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

function biblioFile(quarto: QuartoContext, path: string, csl?: string) {
  // check cache
  const mtimeMs = fs.statSync(path).mtimeMs;
  if (
    (!biblioFiles.has(path) || (biblioFiles.get(path)?.cached || 0) < mtimeMs)
  ) {
    // call pandoc to get refs
   
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
