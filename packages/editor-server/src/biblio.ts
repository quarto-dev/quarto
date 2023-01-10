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

import { pathWithForwardSlashes } from "core";
import { hasExtension } from "core-node";

import {
  metadataFilesForDocument,
  projectDirForDocument,
  QuartoContext,
} from "quarto-core";

import { Bibliography, CSL } from "editor-types";

export type CslRef = {
  id: string;
  cite?: string;
};

export interface BiblioRefs {
  cslRefs: CslRef[];
  csl: CSL[];
  project_biblios: string[];
}

export function cslRefs(
  quarto: QuartoContext,
  docPath: string,
  frontMatter: Record<string, unknown>
) : CslRef[] | null {
  const biblioOptions = bibliographyOptions(path.dirname(docPath), frontMatter);
  return biblioRefs(quarto, docPath, biblioOptions)?.cslRefs || null;
}

export function cslBibliography(
  quarto: QuartoContext,
  docPath: string | null,
  bibliographies: string[],
  refBlock: string | null,
) : Bibliography {

  const refs = biblioRefs(quarto, docPath, { bibliographies });
  const bibliography : Bibliography = {
    sources: refs?.csl || [],
    project_biblios: refs?.project_biblios || []
  }

  // parse ref block
  if (refBlock) {
    try {
      const refBlockYaml = yaml.load(refBlock) as { references: CSL[] };
      bibliography.sources.push(...refBlockYaml.references);
    } catch(err) {
      console.log("Error parsing refBlock yaml");
      console.log(err);
    }
  }

  return bibliography;
}


export function bibliographyOptions(
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

export function generateBibliography(
  quartoContext: QuartoContext,
  biblioJson: string, 
  cslPath?: string, 
  extraArgs?: string[]) {

  // prepare document for rendering
  const biblioJsonPath = tmp.tmpNameSync({ postfix: ".json" });
  try {
    // generate the doc
    const csl = cslPath ? `\ncsl: "${cslPath}"` : "";
    const doc = `---\nbibliography: "${biblioJsonPath}"${csl}\nnocite: |\n  @*\n---\n`;

    // write the biblio 
    fs.writeFileSync(biblioJsonPath, biblioJson, { encoding: "utf-8" });

    // call pandoc
    const args = ["--from", "markdown", "--citeproc", ...(extraArgs || [])];
    return quartoContext.runPandoc({ input: doc }, ...args);
    
  } finally {
    if (fs.existsSync(biblioJsonPath)) {
      fs.unlinkSync(biblioJsonPath);
    }
  }
}

function biblioRefs(
  quarto: QuartoContext,
  docPath: string | null,
  biblioOptions: BiblioOptions
): BiblioRefs | null {
  const projectDir = docPath ? projectDirForDocument(docPath) : undefined;

  // bibliographies from project/dir level metadata
  const projectBiblios: string[] = [];
  if (docPath && projectDir) {
    const metadataFiles = metadataFilesForDocument(docPath);
    if (metadataFiles) {
      metadataFiles.forEach((file) => {
        const fileOptions = biblioOptionsFromMetadataFile(file);
        biblioOptions.bibliographies.push(...fileOptions.bibliographies);
        biblioOptions.csl = biblioOptions.csl || fileOptions.csl;
        projectBiblios.push(...fileOptions.bibliographies);
      });
    }
  }

  if (biblioOptions.bibliographies.length > 0) {

    // process bibliographies
    const biblioRefs = biblioOptions.bibliographies.reduce((refs, file) => {
      const bibFile = biblioFile(quarto, file, biblioOptions.csl);
      if (bibFile) {
        refs.cslRefs.push(
          ...bibFile.refs.filter((ref) => !refs.cslRefs.find((x) => x.id === ref.id))
        );
        refs.csl.push(...bibFile.csl);
      }
      return refs;
    }, { cslRefs: new Array<CslRef>, csl: new Array<CSL>});

    return  {
      ...biblioRefs,
      project_biblios: projectDir ? projectBiblios.map(biblio => path.relative(projectDir, biblio)) : []
    }
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
  csl: CSL[];
};

// cache of biblio files
const biblioFiles = new Map<string, BiblioFile>();

function biblioFile(quarto: QuartoContext, path: string, csl?: string) {
  // check cache
  const mtimeMs = fs.statSync(path).mtimeMs;
  if (
    !biblioFiles.has(path) ||
    (biblioFiles.get(path)?.cached || 0) < mtimeMs
  ) {
    // call pandoc to get refs
    const cslRefs = renderCslRefs(quarto, path, csl);
    const cslJson = renderCslJson(quarto, path);
    if (cslRefs && cslJson) {
      biblioFiles.set(path, {
        path,
        cached: mtimeMs,
        refs: cslRefs,
        csl: cslJson
      });
    }
  }
  return biblioFiles.get(path);
}

function renderCslRefs(
  quarto: QuartoContext,
  file: string,
  csl?: string
): CslRef[] | undefined {
  // create a temp file used as a target document for rendering citations
  const tempDoc = [
    "---",
    `bibliography: "${pathWithForwardSlashes(file)}"`,
    `nocite: "@*"`,
  ];
  if (csl) {
    tempDoc.push(`csl: "${pathWithForwardSlashes(csl)}"`);
  }
  tempDoc.push("---\n");
 
  try {
    const output = quarto.runPandoc(
      { input: tempDoc.join("\n") },
      "--from",
      "markdown",
      "--to",
      "gfm",
      "--citeproc"
    );
    return parseCslRefs(output);
  } catch (err) {
    console.log("Error reading bibliography:");
    console.error(err);
  } 
}

function renderCslJson(quarto: QuartoContext, file: string) : CSL[] | undefined {
  const args = [file, "--standalone"];
  if (isYamlBibliography(file)) {
    args.push(...["--from", "markdown"]);
  } else if (isJsonBibliography(file)) {
    args.push(...["--from", "csljson"]);
  }
  args.push(...["--to", "csljson"]);
  try {
    const output = quarto.runPandoc({}, ...args);
    return JSON.parse(output) as CSL[];
  } catch(err) {
    console.log("Error converting bibliography:");
    console.error(err);
  }
}

function isYamlBibliography(file: string) {
  return hasExtension(file, [".yml", ".yaml"]);
}

function isJsonBibliography(file: string) {
  return hasExtension(file, ".json");
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
