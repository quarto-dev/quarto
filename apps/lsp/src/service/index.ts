/*
 * index.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import type { CancellationToken, CompletionContext } from 'vscode-languageserver';
import * as lsp from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import { LsConfiguration} from './config';
import { MdExtractLinkDefinitionCodeActionProvider } from './providers/codeactions/extract-linkdef';
import { MdRemoveLinkDefinitionCodeActionProvider } from './providers/codeactions/remove-linkdef';
import { MdDefinitionProvider } from './providers/definitions';
import { DiagnosticComputer, DiagnosticOptions, DiagnosticsManager, IPullDiagnosticsManager } from './providers/diagnostics';
import { MdDocumentHighlightProvider } from './providers/document-highlights';
import { createWorkspaceLinkCache, MdLinkProvider, ResolvedDocumentLinkTarget } from './providers/document-links';
import { MdDocumentSymbolProvider } from './providers/document-symbols';
import { FileRename, MdFileRenameProvider } from './providers/file-rename';
import { MdFoldingProvider } from './providers/folding';
import { MdOrganizeLinkDefinitionProvider } from './providers/organize-linkdefs';
import { MdReferencesProvider } from './providers/references';
import { MdRenameProvider } from './providers/rename';
import { MdSelectionRangeProvider } from './providers/smart-select';
import { MdWorkspaceSymbolProvider } from './providers/workspace-symbols';
import { ILogger } from './logging';
import { IMdParser } from './parser';
import { MdTableOfContentsProvider } from './toc';
import { ITextDocument } from './document';
import { isWorkspaceWithFileWatching, IWorkspace } from './workspace';
import { MdHoverProvider } from './providers/hover/hover';
import { MdCompletionProvider } from './providers/completion/completion';
import { Quarto } from './quarto';

export { IncludeWorkspaceHeaderCompletions } from './providers/completion/completion';
export type { MdCompletionProvider } from './providers/completion/completion';
export type { LsConfiguration } from './config';
export { PreferredMdPathExtensionStyle, defaultLsConfiguration } from './config';
export type { DiagnosticOptions, IPullDiagnosticsManager } from './providers/diagnostics';
export { DiagnosticCode, DiagnosticLevel} from './providers/diagnostics';
export type { ResolvedDocumentLinkTarget } from './providers/document-links';
export type { FileRename } from './providers/file-rename';
export { RenameNotSupportedAtLocationError } from './providers/rename';
export type  { ILogger } from './logging';
export { LogLevel } from './logging';
export type { IMdParser, Token } from './parser';
export type { ISlugifier } from './slugify'
export { Slug, pandocSlugifier } from './slugify';
export type { ITextDocument } from './document';
export type { ContainingDocumentContext, FileStat, FileWatcherOptions, IFileSystemWatcher, IWorkspace, IWorkspaceWithWatching } from './workspace';

/**
 * Provides language tooling methods for working with markdown.
 */
export interface IMdLanguageService {

	/**
	 * Get all links of a markdown file.
	 *
	 * Note that you must invoke {@link IMdLanguageService.resolveDocumentLink} on each link before executing the link.
	 */
	getDocumentLinks(document: ITextDocument, token: CancellationToken): Promise<lsp.DocumentLink[]>;

	/**
	 * Resolves a link from {@link IMdLanguageService.getDocumentLinks}.
	 *
	 * This fills in the target on the link.
	 *
	 * @returns The resolved link or `undefined` if the passed in link should be used
	 */
	resolveDocumentLink(link: lsp.DocumentLink, token: CancellationToken): Promise<lsp.DocumentLink | undefined>;

	/**
	 * Try to resolve the resources that a link in a markdown file points to.
	 * 
	 * @param linkText The original text of the link
	 * @param fromResource The resource that contains the link.
	 * 
	 * @returns The resolved target or undefined if it could not be resolved.
	 */
	resolveLinkTarget(linkText: string, fromResource: URI, token: CancellationToken): Promise<ResolvedDocumentLinkTarget | undefined>;

	/**
	 * Get the symbols of a markdown file.
	 *
	 * @returns The headers and optionally also the link definitions in the file
	 */
	getDocumentSymbols(document: ITextDocument, options: { readonly includeLinkDefinitions?: boolean }, token: CancellationToken): Promise<lsp.DocumentSymbol[]>;

	/**
	 * Get the folding ranges of a markdown file.
	 *
	 * This returns folding ranges for:
	 *
	 * - Header sections
	 * - Regions
	 * - List and other block element
	 */
	getFoldingRanges(document: ITextDocument, token: CancellationToken): Promise<lsp.FoldingRange[]>;

	/**
	 * Get the selection ranges of a markdown file.
	 */
	getSelectionRanges(document: ITextDocument, positions: lsp.Position[], token: CancellationToken): Promise<lsp.SelectionRange[] | undefined>;

	/**
	 * Get the symbols for all markdown files in the current workspace.
	 *
	 * Returns all headers in the workspace.
	 */
	getWorkspaceSymbols(query: string, token: CancellationToken): Promise<lsp.WorkspaceSymbol[]>;

	/**
	 * Get completions items at a given position in a markdown file.
	 */
	getCompletionItems(document: ITextDocument, position: lsp.Position, context: CompletionContext | undefined, config: LsConfiguration, token: CancellationToken): Promise<lsp.CompletionItem[]>;

	/**
	 * Get hover at a given position in a markdown file.
	 */
	getHover(
    doc: ITextDocument,
    pos: lsp.Position,
		config: LsConfiguration
  ): Promise<lsp.Hover | null>;

	/**
	 * Get the references to a symbol at the current location.
	 *
	 * Supports finding references to headers and links.
	 */
	getReferences(document: ITextDocument, position: lsp.Position, context: lsp.ReferenceContext, token: CancellationToken): Promise<lsp.Location[]>;

	/**
	 * Get the references to a given file.
	 */
	getFileReferences(resource: URI, token: CancellationToken): Promise<lsp.Location[]>;

	/**
	 * Get the definition of the symbol at the current location.
	 *
	 * Supports finding headers from fragments links or reference link definitions.
	 */
	getDefinition(document: ITextDocument, position: lsp.Position, token: CancellationToken): Promise<lsp.Definition | undefined>;

	/**
	 * Organizes all link definitions in the file by grouping them to the bottom of the file, sorting them, and optionally
	 * removing any unused definitions.
	 *
	 * @returns A set of text edits. May be empty if no edits are required (e.g. the definitions are already sorted at
	 * the bottom of the file).
	 */
	organizeLinkDefinitions(document: ITextDocument, options: { readonly removeUnused?: boolean }, token: CancellationToken): Promise<lsp.TextEdit[]>;

	/**
	 * Prepare for showing rename UI.
	 *
	 * Indicates if rename is supported. If it is, returns the range of symbol being renamed as well as the placeholder to show to the user for the rename.
	 */
	prepareRename(document: ITextDocument, position: lsp.Position, token: CancellationToken): Promise<{ range: lsp.Range; placeholder: string } | undefined>;

	/**
	 * Get the edits for a rename operation.
	 *
	 * @returns A workspace edit that performs the rename or undefined if the rename cannot be performed.
	 */
	getRenameEdit(document: ITextDocument, position: lsp.Position, nameName: string, token: CancellationToken): Promise<lsp.WorkspaceEdit | undefined>;

	/**
	 * Get the edits for a file rename. This update links to the renamed files as well as links within the renamed files.
	 *
	 * This should be invoked after the rename has already happened (i.e. the workspace should reflect the file system state post rename).
	 *
	 * You can pass in uris to resources or directories. However if you pass in multiple edits, these edits must not overlap/conflict.
	 *
	 * @returns An object with a workspace edit that performs the rename and a list of old file uris that effected the edit. Returns undefined if the rename cannot be performed. 
	 */
	getRenameFilesInWorkspaceEdit(edits: readonly FileRename[], token: CancellationToken): Promise<{ participatingRenames: readonly FileRename[]; edit: lsp.WorkspaceEdit } | undefined>;

	/**
	 * Get code actions for a selection in a file.
	 *
	 * Returned code actions may be disabled.
	 */
	getCodeActions(document: ITextDocument, range: lsp.Range, context: lsp.CodeActionContext, token: CancellationToken): Promise<lsp.CodeAction[]>;

	/**
	 * Get document highlights for a position in the document.
	 */
	getDocumentHighlights(document: ITextDocument, position: lsp.Position, token: CancellationToken): Promise<lsp.DocumentHighlight[]>;

	/**
	 * Compute diagnostics for a given file.
	 *
	 * Note that this function is stateless and re-validates all links every time you make the request. Use {@link IMdLanguageService.createPullDiagnosticsManager}
	 * to more efficiently get diagnostics.
	 */
	computeDiagnostics(doc: ITextDocument, options: DiagnosticOptions, token: CancellationToken): Promise<lsp.Diagnostic[]>;

	/**
	 * Create a stateful object that is more efficient at computing diagnostics across repeated calls and workspace changes.
	 *
	 * This requires a {@link IWorkspace workspace} that {@link IWorkspaceWithWatching supports file watching}.
	 *
	 * Note that you must dispose of the returned object once you are done using it.
	 */
	createPullDiagnosticsManager(): IPullDiagnosticsManager;

	/**
	 * Dispose of the language service, freeing any associated resources.
	 */
	dispose(): void;
}

/**
 * Initialization options for creating a new {@link IMdLanguageService}.
 */
export interface LanguageServiceInitialization {
	readonly config: LsConfiguration;
	readonly quarto: Quarto;
	readonly workspace: IWorkspace;
	readonly parser: IMdParser;
	readonly logger: ILogger;
}

/**
 * Create a new instance of the {@link IMdLanguageService language service}.
 */
export function createLanguageService(init: LanguageServiceInitialization): IMdLanguageService {
	const config = init.config;
	const logger = init.logger;

	const tocProvider = new MdTableOfContentsProvider(init.parser, init.workspace, logger);
	const smartSelectProvider = new MdSelectionRangeProvider(init.parser, tocProvider, logger);
	const foldingProvider = new MdFoldingProvider(init.parser, tocProvider, logger);
	const linkProvider = new MdLinkProvider(config, init.parser, init.workspace, tocProvider, logger);
	const completionProvider = new MdCompletionProvider(config, init.quarto, init.workspace, init.parser, linkProvider, tocProvider);
	const hoverProvider = new MdHoverProvider(init.quarto);
	const linkCache = createWorkspaceLinkCache(init.parser, init.workspace);
	const referencesProvider = new MdReferencesProvider(config, init.parser, init.workspace, tocProvider, linkCache, logger);
	const definitionsProvider = new MdDefinitionProvider(config, init.workspace, tocProvider, linkCache);
	const renameProvider = new MdRenameProvider(config, init.workspace, referencesProvider, init.parser.slugifier, logger);
	const fileRenameProvider = new MdFileRenameProvider(config, init.workspace, linkCache, referencesProvider);
	const diagnosticsComputer = new DiagnosticComputer(config, init.quarto, init.workspace, linkProvider, tocProvider, logger);
	const docSymbolProvider = new MdDocumentSymbolProvider(tocProvider, linkProvider, logger);
	const workspaceSymbolProvider = new MdWorkspaceSymbolProvider(init.workspace, docSymbolProvider);
	const organizeLinkDefinitions = new MdOrganizeLinkDefinitionProvider(linkProvider);
	const documentHighlightProvider = new MdDocumentHighlightProvider(config, tocProvider, linkProvider);

	const extractCodeActionProvider = new MdExtractLinkDefinitionCodeActionProvider(linkProvider);
	const removeLinkDefinitionActionProvider = new MdRemoveLinkDefinitionCodeActionProvider();

	return Object.freeze<IMdLanguageService>({
		dispose: () => {
			linkCache.dispose();
			tocProvider.dispose();
			workspaceSymbolProvider.dispose();
			linkProvider.dispose();
			referencesProvider.dispose();
		},
		getDocumentLinks: linkProvider.provideDocumentLinks.bind(linkProvider),
		resolveDocumentLink: linkProvider.resolveDocumentLink.bind(linkProvider),
		resolveLinkTarget: linkProvider.resolveLinkTarget.bind(linkProvider),
		getDocumentSymbols: docSymbolProvider.provideDocumentSymbols.bind(docSymbolProvider),
		getFoldingRanges: foldingProvider.provideFoldingRanges.bind(foldingProvider),
		getSelectionRanges: smartSelectProvider.provideSelectionRanges.bind(smartSelectProvider),
		getWorkspaceSymbols: workspaceSymbolProvider.provideWorkspaceSymbols.bind(workspaceSymbolProvider),
		getCompletionItems: completionProvider.provideCompletionItems.bind(completionProvider),
		getHover: hoverProvider.provideHover.bind(hoverProvider),
		getReferences: referencesProvider.provideReferences.bind(referencesProvider),
		getFileReferences: async (resource: URI, token: CancellationToken): Promise<lsp.Location[]> => {
			return (await referencesProvider.getReferencesToFileInWorkspace(resource, token)).map(x => x.location);
		},
		getDefinition: definitionsProvider.provideDefinition.bind(definitionsProvider),
		organizeLinkDefinitions: organizeLinkDefinitions.getOrganizeLinkDefinitionEdits.bind(organizeLinkDefinitions),
		prepareRename: renameProvider.prepareRename.bind(renameProvider),
		getRenameEdit: renameProvider.provideRenameEdits.bind(renameProvider),
		getRenameFilesInWorkspaceEdit: fileRenameProvider.getRenameFilesInWorkspaceEdit.bind(fileRenameProvider),
		getCodeActions: async (doc: ITextDocument, range: lsp.Range, context: lsp.CodeActionContext, token: CancellationToken): Promise<lsp.CodeAction[]> => {
			return (await Promise.all([
				extractCodeActionProvider.getActions(doc, range, context, token),
				Array.from(removeLinkDefinitionActionProvider.getActions(doc, range, context)),
			])).flat();
		},
		getDocumentHighlights: (document: ITextDocument, position: lsp.Position, token: CancellationToken): Promise<lsp.DocumentHighlight[]> => {
			return documentHighlightProvider.getDocumentHighlights(document, position, token);
		},
		computeDiagnostics: async (doc: ITextDocument, options: DiagnosticOptions, token: CancellationToken): Promise<lsp.Diagnostic[]> => {
			return (await diagnosticsComputer.compute(doc, options, token))?.diagnostics;
		},
		createPullDiagnosticsManager: () => {
			if (!isWorkspaceWithFileWatching(init.workspace)) {
				throw new Error(`Workspace does not support file watching. Diagnostics manager not supported`);
			}
			return new DiagnosticsManager(config, init.quarto, init.workspace, linkProvider, tocProvider, logger);
		}
	});
}
