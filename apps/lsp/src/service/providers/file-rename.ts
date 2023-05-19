/*
 * file-rename.ts
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

import * as path from 'path';
import { CancellationToken } from 'vscode-languageserver';
import * as lsp from 'vscode-languageserver-types';
import { URI, Utils } from 'vscode-uri';

import { Disposable } from 'core';

import { isExcludedPath, LsConfiguration, PreferredMdPathExtensionStyle } from '../config';
import { getDocUri, ITextDocument } from '../util/text-document';
import { WorkspaceEditBuilder } from '../util/edit-builder';
import { looksLikeMarkdownUri } from '../util/file';
import { isParentDir } from '../util/path';
import { IWorkspace } from '../workspace';
import { MdWorkspaceInfoCache } from '../workspace-cache';
import { HrefKind, InternalHref, MdLink, resolveInternalDocumentLink } from './document-links';
import { MdReferenceKind, MdReferencesProvider } from './references';
import { getFilePathRange, getLinkRenameText } from './rename';


export interface FileRename {
	readonly oldUri: URI;
	readonly newUri: URI;
}

export interface FileRenameResponse {
	participatingRenames: readonly FileRename[];
	edit: lsp.WorkspaceEdit;
}

export class MdFileRenameProvider extends Disposable {

	readonly #config: LsConfiguration;
	readonly #workspace: IWorkspace;
	readonly #linkCache: MdWorkspaceInfoCache<readonly MdLink[]>;
	readonly #referencesProvider: MdReferencesProvider;

	public constructor(
		config: LsConfiguration,
		workspace: IWorkspace,
		linkCache: MdWorkspaceInfoCache<readonly MdLink[]>,
		referencesProvider: MdReferencesProvider,
	) {
		super();

		this.#config = config;
		this.#workspace = workspace;
		this.#linkCache = linkCache;
		this.#referencesProvider = referencesProvider;
	}

	async getRenameFilesInWorkspaceEdit(edits: readonly FileRename[], token: CancellationToken): Promise<FileRenameResponse | undefined> {
		const builder = new WorkspaceEditBuilder();
		const participatingRenames: FileRename[] = [];

		for (const edit of edits) {
			const stat = await this.#workspace.stat(edit.newUri);
			if (token.isCancellationRequested) {
				return undefined;
			}

			if (await (stat?.isDirectory ? this.#addDirectoryRenameEdits(edit, builder, token) : this.#addSingleFileRenameEdits(edit, edits, builder, token))) {
				participatingRenames.push(edit);
			}

			if (token.isCancellationRequested) {
				return undefined;
			}
		}

		return { participatingRenames, edit: builder.getEdit() };
	}

	async #addSingleFileRenameEdits(edit: FileRename, allEdits: readonly FileRename[], builder: WorkspaceEditBuilder, token: CancellationToken): Promise<boolean> {
		let didParticipate = false;

		// Update all references to the file
		if (await this.#addEditsForReferencesToFile(edit, builder, token)) {
			didParticipate = true;
		}

		if (token.isCancellationRequested) {
			return false;
		}

		// If the file moved was markdown, we also need to update links in the file itself
		if (await this.#tryAddEditsInSelf(edit, allEdits, builder)) {
			didParticipate = true;
		}

		return didParticipate;
	}

	async #addDirectoryRenameEdits(edit: FileRename, builder: WorkspaceEditBuilder, token: CancellationToken): Promise<boolean> {
		// First update every link that points to something in the moved dir
		const allLinksInWorkspace = await this.#linkCache.entries();
		if (token.isCancellationRequested) {
			return false;
		}

		let didParticipate = false;
		for (const [docUri, links] of allLinksInWorkspace) {
			for (const link of links) {
				if (link.href.kind !== HrefKind.Internal) {
					continue;
				}

				// Update links to the moved dir
				if (isParentDir(edit.oldUri, link.href.path)) {
					const relative = path.posix.relative(edit.oldUri.path, link.href.path.path);
					const newUri = edit.newUri.with({
						path: path.posix.join(edit.newUri.path, relative)
					});

					if (this.#addLinkRenameEdit(docUri, link, newUri, builder)) {
						didParticipate = true;
						continue;
					}
				}

				// If the link was within a file in the moved dir but traversed out of it, we also need to update the path
				if (link.source.pathText.startsWith('..') && isParentDir(edit.newUri, docUri)) {
					// Resolve the link relative to the old file path
					const oldDocUri = docUri.with({
						path: Utils.joinPath(edit.oldUri, path.posix.relative(edit.newUri.path, docUri.path)).path
					});

					const oldLink = resolveInternalDocumentLink(oldDocUri, link.source.hrefText, this.#workspace);
					if (oldLink) {
						let newPathText: string;
						if (isParentDir(edit.oldUri, oldLink.resource)) {
							// The link still points within the directory being moved.
							// This means we just need to normalize the path it in case it was referencing any old names.
							const rootDir = Utils.dirname(oldDocUri);
							newPathText = './' + path.posix.relative(rootDir.path, oldLink.resource.path);
						} else {
							const rootDir = Utils.dirname(docUri);
							newPathText = path.posix.relative(rootDir.path, oldLink.resource.path);
						}

						didParticipate = true;
						builder.replace(docUri, getFilePathRange(link), encodeURI(newPathText));
					}
				}
			}
		}

		return didParticipate;
	}

	/**
	 * Try to add edits for when a markdown file has been renamed.
	 * In this case we also need to update links within the file.
	 */
	async #tryAddEditsInSelf(edit: FileRename, allEdits: readonly FileRename[], builder: WorkspaceEditBuilder): Promise<boolean> {
		if (!looksLikeMarkdownUri(this.#config, edit.newUri)) {
			return false;
		}

		if (isExcludedPath(this.#config, edit.newUri)) {
			return false;
		}

		const doc = await this.#workspace.openMarkdownDocument(edit.newUri);
		if (!doc) {
			return false;
		}

		const links = (await this.#linkCache.getForDocs([doc]))[0];

		let didParticipate = false;
		for (const link of links) {
			if (await this.#addEditsForLinksInSelf(doc, link, edit, allEdits, builder)) {
				didParticipate = true;
			}
		}
		return didParticipate;
	}

	async #addEditsForLinksInSelf(doc: ITextDocument, link: MdLink, edit: FileRename, allEdits: readonly FileRename[], builder: WorkspaceEditBuilder): Promise<boolean> {
		if (link.href.kind !== HrefKind.Internal) {
			return false;
		}

		if (link.source.hrefText.startsWith('#')) {
			// No rewrite needed as we are referencing the current doc implicitly
			return false;
		}

		if (link.source.hrefText.startsWith('/')) {
			// We likely don't need to update anything since an absolute path is used
			return false;
		}

		// Resolve the link relative to the old file path
		let oldLink = resolveInternalDocumentLink(edit.oldUri, link.source.hrefText, this.#workspace);
		if (!oldLink) {
			return false;
		}

		// See if the old link was effected by one of the renames
		for (const edit of allEdits) {
			if (edit.oldUri.toString() === oldLink.resource.toString() || isParentDir(edit.oldUri, oldLink.resource)) {
				oldLink = { resource: Utils.joinPath(edit.newUri, path.posix.relative(edit.oldUri.path, oldLink.resource.path)), linkFragment: oldLink.linkFragment };
				break;
			}
		}

		return this.#addLinkRenameEdit(getDocUri(doc), link, oldLink.resource, builder);
	}

	/**
	 * Update links across the workspace for the new file name
	 */
	async #addEditsForReferencesToFile(edit: FileRename, builder: WorkspaceEditBuilder, token: CancellationToken): Promise<boolean> {
		if (isExcludedPath(this.#config, edit.newUri)) {
			return false;
		}

		const refs = await this.#referencesProvider.getReferencesToFileInWorkspace(edit.oldUri, token);
		if (token.isCancellationRequested) {
			return false;
		}

		let didParticipate = false;
		for (const ref of refs) {
			if (ref.kind === MdReferenceKind.Link) {
				if (this.#addLinkRenameEdit(URI.parse(ref.location.uri), ref.link, edit.newUri, builder)) {
					didParticipate = true;
				}
			}
		}
		return didParticipate;
	}

	#addLinkRenameEdit(doc: URI, link: MdLink, newUri: URI, builder: WorkspaceEditBuilder): boolean {
		if (link.href.kind !== HrefKind.Internal) {
			return false;
		}

		let newFilePath = newUri;

		if (this.#shouldRemoveFileExtensionForRename(link.href, newUri)) {
			const editExt = Utils.extname(newUri);
			newFilePath = newUri.with({
				path: newUri.path.slice(0, newUri.path.length - editExt.length)
			});
		}

		const newLinkText = getLinkRenameText(this.#workspace, link.source, newFilePath, link.source.pathText.startsWith('.'));
		if (typeof newLinkText === 'string') {
			builder.replace(doc, getFilePathRange(link), encodeURI(newLinkText));
			return true;
		}
		return false;
	}

	#shouldRemoveFileExtensionForRename(originalHref: InternalHref, newUri: URI): boolean {
		if (!looksLikeMarkdownUri(this.#config, newUri)) {
			return false;
		}

		if (this.#config.preferredMdPathExtensionStyle === PreferredMdPathExtensionStyle.removeExtension) {
			return true;
		}

		// If the original markdown link did not use a file extension, remove ours too
		return !Utils.extname(originalHref.path);
	}
}
