/*
 * csl.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Bibliography } from "./csl";

export const kPandocGetCapabilities = 'pandoc_get_capabilities';
export const kPandocMarkdownToAst = 'pandoc_markdown_to_ast';
export const kPandocAstToMarkdown = 'pandoc_ast_to_markdown';
export const kPandocListExtensions = 'pandoc_list_extensions';
export const kPandocGetBibliography  = 'pandoc_get_bibliography';
export const kPandocAddtoBibliography = 'pandoc_add_to_bibliography';
export const kPandocCitationHtml = 'pandoc_citation_html';

export type PandocApiVersion = number[];

export interface PandocServer {
  getCapabilities(): Promise<PandocCapabilitiesResult>;
  markdownToAst(markdown: string, format: string, options: string[]): Promise<PandocAst>;
  astToMarkdown(ast: PandocAst, format: string, options: string[]): Promise<string>;
  listExtensions(format: string): Promise<string>;
  getBibliography(
    file: string | null,
    bibliography: string[],
    refBlock: string | null,
    etag: string | null,
  ): Promise<BibliographyResult>;
  addToBibliography(
    bibliography: string,
    project: boolean,
    id: string,
    sourceAsJson: string,
    sourceAsBibTeX: string,
    documentPath: string | null
  ): Promise<boolean>;
  citationHTML(file: string | null, sourceAsJson: string, csl: string | null): Promise<string>;
}

export interface BibliographyResult {
  etag: string;
  bibliography: Bibliography;
}

export interface PandocCapabilitiesResult {
  version: string;
  api_version: PandocApiVersion;
  output_formats: string;
  highlight_languages: string;
}


export interface PandocAst {
  blocks: PandocToken[];
  'pandoc-api-version': PandocApiVersion;
  meta: Record<string,unknown>;
  heading_ids?: string[]; // used only for reading not writing
}

export interface PandocToken {
  t: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c?: any;
}

export interface PandocAttr {
  id: string;
  classes: string[];
  keyvalue: Array<[string, string]>;
}

