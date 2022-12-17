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
import * as child_process from "child_process";

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

import { EditorServerOptions } from './server';


export interface PandocServerOptions {
  pandocPath: string;
  resourcesDir: string;
  payloadLimitMb: number;
}

export function pandocServer(options: PandocServerOptions) : PandocServer {

  async function runPandoc(args: readonly string[] | null, stdin?: string) : Promise<string> {
    return new Promise((resolve, reject) => {
      const child = child_process.execFile(options.pandocPath, args, { 
        encoding: "utf-8", 
        maxBuffer: options.payloadLimitMb * 1024 * 1024 }, 
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
         "--abbreviations", path.join(options.resourcesDir, 'abbreviations'),
         "--to", "json", ...mdOptions],
         markdown)
      ) as PandocAst;

      // heading-ids
      // disable auto identifiers so we can discover *only* explicit ids
      format += "-auto_identifiers-gfm_auto_identifiers";
      const headingIds = await runPandoc(
        ["--from", format,
         "--to", "plain",
         "--lua-filter", path.join(options.resourcesDir, 'heading-ids.lua'),
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
      etag: string | null,
    ): Promise<BibliographyResult> {
      return {
        etag: 'foo',
        bibliography: {
          sources: [],
          project_biblios: []
        }
      }
    },

    addToBibliography(
      bibliography: string,
      project: boolean,
      id: string,
      sourceAsJson: string,
      sourceAsBibTeX: string,
    ): Promise<boolean> {
      throw new Error("not implemented");
    },
    citationHTML(file: string | null, sourceAsJson: string, csl: string | null): Promise<string> {
      throw new Error("not implemented");
    }
  };
}

export function pandocServerMethods(options: EditorServerOptions) : Record<string, JsonRpcServerMethod> {
  const server = pandocServer(options.pandoc);
  const methods: Record<string, JsonRpcServerMethod> = {
    [kPandocGetCapabilities]: () => server.getCapabilities(),
    [kPandocMarkdownToAst]: args => server.markdownToAst(args[0], args[1], args[2]),
    [kPandocAstToMarkdown]: args => server.astToMarkdown(args[0], args[1], args[2]),
    [kPandocListExtensions]: args => server.listExtensions(args[0]),
    [kPandocGetBibliography]: args => server.getBibliography(args[0], args[1], args[2], args[3]),
    [kPandocAddtoBibliography]: args => server.addToBibliography(args[0], args[1], args[2], args[3], args[4]),
    [kPandocCitationHtml]: args => server.citationHTML(args[0], args[1], args[2])
  };
  return methods;
}



