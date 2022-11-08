/* eslint-disable @typescript-eslint/no-unused-vars */

/*
 * editor-server.ts
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
  kPandocAddtoBibliography,
  kPandocCitationHtml,
  kPandocGetBibliography,
  kPandocGetCapabilities,
  kPandocListExtensions,
  kPandocMarkdownToAst,
  PandocAst,
  PandocCapabilitiesResult,
} from "editor-types";

import ClientBrowser from "jayson/lib/client/browser";

export function editorJsonRpcServer(url: string) {
  const callServer = (
    request: string,
    callback: (err?: Error | null, response?: string) => void
  ) => {
    const options = {
      method: "POST",
      body: request,
      headers: {
        "Content-Type": "application/json",
      },
    };
    fetch(url, options)
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        callback(null, text);
      })
      .catch(function (err) {
        callback(err);
      });
  };

  const client = new ClientBrowser(callServer, {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = (method: string, params: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<any>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.request(method, params, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

  return {
    pandoc: {
      getCapabilities(): Promise<PandocCapabilitiesResult> {
        return request(kPandocGetCapabilities, []);
      },
      markdownToAst(
        markdown: string,
        format: string,
        options: string[]
      ): Promise<PandocAst> {
        return request(kPandocMarkdownToAst, [markdown, format, options]);
      },
      astToMarkdown(
        ast: PandocAst,
        format: string,
        options: string[]
      ): Promise<string> {
        return request(kPandocMarkdownToAst, [ast, format, options]);
      },
      listExtensions(format: string): Promise<string> {
        return request(kPandocListExtensions, [format]);
      },
      getBibliography(
        file: string | null,
        bibliography: string[],
        refBlock: string | null,
        etag: string | null
      ): Promise<BibliographyResult> {
        return request(kPandocGetBibliography, [
          file,
          bibliography,
          refBlock,
          etag,
        ]);
      },
      addToBibliography(
        bibliography: string,
        project: boolean,
        id: string,
        sourceAsJson: string,
        sourceAsBibTeX: string
      ): Promise<boolean> {
        return request(kPandocAddtoBibliography, [
          bibliography,
          project,
          id,
          sourceAsJson,
          sourceAsBibTeX,
        ]);
      },
      citationHTML(
        file: string | null,
        sourceAsJson: string,
        csl: string | null
      ): Promise<string> {
        return request(kPandocCitationHtml, [file, sourceAsJson, csl]);
      },
    },
  };
}
