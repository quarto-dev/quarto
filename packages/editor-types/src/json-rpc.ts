/*
 * json-rpc.ts
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

// pandoc server
export const kPandocGetCapabilities = 'pandoc_get_capabilities';
export const kPandocMarkdownToAst = 'pandoc_markdown_to_ast';
export const kPandocAstToMarkdown = 'pandoc_ast_to_markdown';
export const kPandocListExtensions = 'pandoc_list_extensions';
export const kPandocGetBibliography  = 'pandoc_get_bibliography';
export const kPandocAddtoBibliography = 'pandoc_add_to_bibliography';
export const kPandocCitationHtml = 'pandoc_citation_html';