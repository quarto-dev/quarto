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
} from "editor-types";

import jayson from 'jayson'
import { jsonRcpMethod } from "./json-rpc";


export function pandocServer() : PandocServer {
  return {
    async getCapabilities(): Promise<PandocCapabilitiesResult> {
      return {
        version: "2.19.2",
        api_version: [2,19,2],
        output_formats: 'html',
        highlight_languages: 'python'
      }
    },
    markdownToAst(markdown: string, format: string, options: string[]): Promise<PandocAst> {
      throw new Error("not implemented");
    },
    astToMarkdown(ast: PandocAst, format: string, options: string[]): Promise<string> {
      throw new Error("not implemented");
    },
    listExtensions(format: string): Promise<string> {
      throw new Error("not implemented");
    },
    getBibliography(
      file: string | null,
      bibliography: string[],
      refBlock: string | null,
      etag: string | null,
    ): Promise<BibliographyResult> {
      throw new Error("not implemented");
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

export function pandocServerMethods() : Record<string, jayson.Method> {
  const server = pandocServer();
  const methods: Record<string, jayson.Method> = {
    [kPandocGetCapabilities]: jsonRcpMethod(() => server.getCapabilities()),
    [kPandocMarkdownToAst]: jsonRcpMethod(args => server.markdownToAst(args[0], args[1], args[2])),
    [kPandocAstToMarkdown]: jsonRcpMethod(args => server.astToMarkdown(args[0], args[1], args[2])),
    [kPandocListExtensions]: jsonRcpMethod(args => server.listExtensions(args[0])),
    [kPandocGetBibliography]: jsonRcpMethod(args => server.getBibliography(args[0], args[1], args[2], args[3])),
    [kPandocAddtoBibliography]: jsonRcpMethod(args => server.addToBibliography(args[0], args[1], args[2], args[3], args[4]))
  };
  return methods;
}

