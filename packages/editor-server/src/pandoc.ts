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
  kPandocCitationHtml
} from "editor-types";

import jayson from 'jayson'

import { EditorServerOptions } from './server';
import { jsonRpcMethod } from 'core-server';


export function pandocServer(options: EditorServerOptions) : PandocServer {

  async function runPandoc(args: readonly string[] | null, stdin?: string) : Promise<string> {
    return new Promise((resolve, reject) => {
      const child = child_process.execFile("pandoc", args, { 
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
    async markdownToAst(params: { markdown: string, format: string, options: string[] }): Promise<PandocAst> {
      // ast
      const ast = JSON.parse(await runPandoc(
        ["--from", params.format,
         "--abbreviations", path.join(options.resourcesDir, 'abbreviations'),
         "--to", "json", ...params.options],
         params.markdown)
      ) as PandocAst;

      // heading-ids
      // disable auto identifiers so we can discover *only* explicit ids
      params.format += "-auto_identifiers-gfm_auto_identifiers";
      const headingIds = await runPandoc(
        ["--from", params.format,
         "--to", "plain",
         "--lua-filter", path.join(options.resourcesDir, 'heading-ids.lua'),
        ],
        params.markdown
      );

      if (headingIds) {
        ast.heading_ids = headingIds.split('\n').filter(id => id.length !== 0);
      }

      return ast;
    },
    async astToMarkdown(params: { ast: PandocAst, format: string, options: string[] }): Promise<string> {
      const markdown = await runPandoc(
        ["--from", "json",
         "--to", params.format, ...params.options] ,
         JSON.stringify(params.ast)
      );
      return markdown;
    },
    async listExtensions(params: { format: string }): Promise<string> {
      const args = ["--list-extensions"];
      if (params.format.length > 0) {
        args.push(params.format);
      }
      return await runPandoc(args);
    },
    async getBibliography(params: {
      file: string | null,
      bibliography: string[],
      refBlock: string | null,
      etag: string | null,
    }): Promise<BibliographyResult> {
      return {
        etag: 'foo',
        bibliography: {
          sources: [],
          project_biblios: []
        }
      }
    },
    addToBibliography(params: {
      bibliography: string,
      project: boolean,
      id: string,
      sourceAsJson: string,
      sourceAsBibTeX: string,
    }): Promise<boolean> {
      throw new Error("not implemented");
    },
    citationHTML(params: { file: string | null, sourceAsJson: string, csl: string | null }): Promise<string> {
      throw new Error("not implemented");
    }
  };
}

export function pandocServerMethods(options: EditorServerOptions) : Record<string, jayson.Method> {
  const server = pandocServer(options);
  const methods: Record<string, jayson.Method> = {
    [kPandocGetCapabilities]: jsonRpcMethod(() => server.getCapabilities()),
    [kPandocMarkdownToAst]: jsonRpcMethod(params => server.markdownToAst(params)),
    [kPandocAstToMarkdown]: jsonRpcMethod(params => server.astToMarkdown(params)),
    [kPandocListExtensions]: jsonRpcMethod(params => server.listExtensions(params)),
    [kPandocGetBibliography]: jsonRpcMethod(params => server.getBibliography(params)),
    [kPandocAddtoBibliography]: jsonRpcMethod(params => server.addToBibliography(params)),
    [kPandocCitationHtml]: jsonRpcMethod(params => server.citationHTML(params))
  };
  return methods;
}



