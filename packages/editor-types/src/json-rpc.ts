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

// pandoc
export const kPandocGetCapabilities = 'pandoc_get_capabilities';
export const kPandocMarkdownToAst = 'pandoc_markdown_to_ast';
export const kPandocAstToMarkdown = 'pandoc_ast_to_markdown';
export const kPandocListExtensions = 'pandoc_list_extensions';
export const kPandocGetBibliography  = 'pandoc_get_bibliography';
export const kPandocAddtoBibliography = 'pandoc_add_to_bibliography';
export const kPandocCitationHtml = 'pandoc_citation_html';

// doi
export const kDoiFetchCsl = 'doi_fetch_csl';

// crossref
export const kCrossrefWorks = 'crossref_works';

// datacite
export const kDataCiteSearch = 'datacite_search';

// pubmed
export const kPubMedSearch = 'pubmed_search';

// zotero
export const kZoteroValidateWebApiKey = 'zotero_validate_web_api_key';
export const kZoteroGetCollections = 'zotero_get_collections';
export const kZoteroGetLibraryNames = 'zotero_get_library_names';
export const kZoteroGetActiveCollectionSpecs = 'zotero_get_active_collection_specs';
export const kZoteroBetterBibtexExport = 'zotero_better_bibtex_export';

// xref
export const kXRefIndexForFile = 'xref_index_for_file';
export const kXRefForId = 'xref_for_id';
export const kXRefQuartoIndexForFile = 'xref_quarto_index_for_file';
export const kXRefQuartoXRefForId = 'xref_quarto_xref_for_id';

// environment
export const kEnvironmentGetRPackageState = 'environment_get_r_package_state';
export const kEnvironmentGetRPackageCitations = 'environment_get_r_package_citations';

