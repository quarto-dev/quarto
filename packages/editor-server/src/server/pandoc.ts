/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * pandoc.ts
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


import stream from 'stream';
import path from 'path';
import * as fs from "fs";
import * as child_process from "child_process";
import * as uuid from 'uuid';

import { JsonRpcServerMethod } from 'core';

import { 
  BibliographyResult, 
  PandocAst, 
  PandocCapabilitiesResult, 
  PandocServer,
  kPandocAstToMarkdown, 
  kPandocGetCapabilities, 
  kPandocListExtensions, 
  kPandocMarkdownToAst,
  kPandocGetBibliography,
  kPandocAddtoBibliography,
  kPandocCitationHtml, 
} from "editor-types";

import { projectDirForDocument } from 'quarto-core';

import { 
  appendToJSONBibliography, 
  appendToYAMLBibliography, 
  cslBibliography, 
  generateHTMLBibliography, 
  generateCSLBibliography,
  isJsonBibliography, 
  isYamlBibliography, 
  resolveBiblioOptions 
} from '../biblio';

import { EditorServerOptions } from './server';



export interface PandocServerOptions {
  pandocPath: string;
  resourcesDir: string;
  payloadLimitMb: number;
}

export function pandocServer(options: EditorServerOptions) : PandocServer {

  async function runPandoc(args: readonly string[] | null, stdin?: string) : Promise<string> {
    return new Promise((resolve, reject) => {
      const child = child_process.execFile(options.pandoc.pandocPath, args, { 
        encoding: "utf-8", 
        maxBuffer: options.pandoc.payloadLimitMb * 1024 * 1024 }, 
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else if (child.exitCode !== 0) {
            reject(new Error(`Error status ${child.exitCode}: ${stderr.trim()}`));
          } else {
            resolve(stdout.trim());
          }
      });  
      if (stdin) {
        const stdinStream = new stream.Readable();
        stdinStream.push(stdin);  
        stdinStream.push(null);  
        if (child.stdin) {
          child.stdin.on('error', () => {
            // allow errors to be reported by main handler
          });
          stdinStream.pipe(child.stdin);
        } else {
          reject(new Error("Unable to access Pandoc stdin stream"));
        }
      }
    });
  }

  return {
    async getCapabilities(): Promise<PandocCapabilitiesResult> {
      const version = await runPandoc(["--version"]);
      const ast = JSON.parse(await runPandoc(["--to", "json"], " ")) as PandocAst;
      const formats = await runPandoc(["--list-output-formats"]);
      const languages = await runPandoc(["--list-highlight-languages"]);
      return {
        version,
        api_version: ast['pandoc-api-version'],
        output_formats: formats,
        highlight_languages: languages
      }
    },
    async markdownToAst(markdown: string, format: string, mdOptions: string[]): Promise<PandocAst> {
      // ast
      const ast = JSON.parse(await runPandoc(
        ["--from", format,
         "--abbreviations", path.join(options.pandoc.resourcesDir, 'abbreviations'),
         "--to", "json", ...mdOptions],
         markdown)
      ) as PandocAst;

      // heading-ids
      // disable auto identifiers so we can discover *only* explicit ids
      format += "-auto_identifiers-gfm_auto_identifiers";
      const headingIds = await runPandoc(
        ["--from", format,
         "--to", "plain",
         "--lua-filter", path.join(options.pandoc.resourcesDir, 'heading-ids.lua'),
        ],
        markdown
      );

      if (headingIds) {
        ast.heading_ids = headingIds.split('\n').filter(id => id.length !== 0);
      }
  
      return ast;
    },
    async astToMarkdown(ast: PandocAst, format: string, options: string[]): Promise<string> {
      const markdown = await runPandoc(
        ["--from", "json",
         "--to", format, ...options],
         JSON.stringify(ast)
      );
      return markdown;
    },
    async listExtensions(format: string): Promise<string> {
      const args = ["--list-extensions"];
      if (format.length > 0) {
        args.push(format);
      }
      return await runPandoc(args);
    },
    async getBibliography(
      file: string | null,
      bibliography: string[],
      refBlock: string | null,
      _etag: string | null,
    ): Promise<BibliographyResult> {
      const cslBiblio = cslBibliography(options.quartoContext, file, bibliography, refBlock);
      return {
        etag: uuid.v4(),
        bibliography: cslBiblio
      }
    },

    async addToBibliography(
      bibliography: string,
      project: boolean,
      id: string,
      sourceAsJson: string,
      sourceAsBibTeX: string,
      documentPath: string | null
    ): Promise<boolean> {

      // if this is a project then resolve it against the the project dir
      if (project) {
        const projDir = documentPath ? projectDirForDocument(documentPath) : undefined;
        if (!projDir) {
          throw new Error(`Attempted to add to project bibliography but no project context found (${documentPath})`);
        }
        bibliography = path.join(projDir, bibliography);
      }

      // write to the requisite format
      const isYAML = isYamlBibliography(bibliography);
      const isJSON = isJsonBibliography(bibliography);
      if (isYAML || isJSON) {
        const args = ["--standalone", "--to"];
        if (isYAML) {
          args.push("markdown");
        } else {
          args.push("csljson");
        }
        const entry = generateCSLBibliography(options.quartoContext, sourceAsJson, isYAML ? 'yaml' : 'json');
        if (isYAML) {
          appendToYAMLBibliography(bibliography, id, entry);
        } else {
          appendToJSONBibliography(bibliography, id, entry);
        }
      } else {
        fs.appendFileSync(bibliography, `\n${sourceAsBibTeX}\n`, { encoding: "utf-8" });
      }

      return true;
    },

    async citationHTML(file: string | null, sourceAsJson: string, csl: string | null): Promise<string> {

      // compute csl path if we can
      let cslPath = (csl && file) ? path.join(path.dirname(file), csl) : undefined;
      // if we don't have one and we have a file then try to compute from project
      if (!cslPath && file) {
        const projectDir = projectDirForDocument(file);
        if (projectDir) {
          const { biblioOptions } = resolveBiblioOptions(file, { bibliographies: [] })
          cslPath = biblioOptions.csl;
        }
      }

      // generate bibliography
      return generateHTMLBibliography(options.quartoContext, sourceAsJson, cslPath);

    }
  };
}

export function pandocServerMethods(options: EditorServerOptions) : Record<string, JsonRpcServerMethod> {
  const server = pandocServer(options);
  const methods: Record<string, JsonRpcServerMethod> = {
    [kPandocGetCapabilities]: () => server.getCapabilities(),
    [kPandocMarkdownToAst]: args => server.markdownToAst(args[0], args[1], args[2]),
    [kPandocAstToMarkdown]: args => server.astToMarkdown(args[0], args[1], args[2]),
    [kPandocListExtensions]: args => server.listExtensions(args[0]),
    [kPandocGetBibliography]: args => server.getBibliography(args[0], args[1], args[2], args[3]),
    [kPandocAddtoBibliography]: args => server.addToBibliography(args[0], args[1], args[2], args[3], args[4], args[5]),
    [kPandocCitationHtml]: args => server.citationHTML(args[0], args[1], args[2])
  };
  return methods;
}



