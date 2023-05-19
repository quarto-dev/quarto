/*
 * extract-linkdef.ts
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

import * as l10n from '@vscode/l10n';
import { CancellationToken } from 'vscode-languageserver';
import * as lsp from 'vscode-languageserver-types';
import { comparePosition, translatePosition } from '../../types/position';
import { makeRange, rangeIntersects } from '../../types/range';
import { getDocUri, getLine, ITextDocument } from '../../types/text-document';
import { WorkspaceEditBuilder } from '../../util/edit-builder';
import { ExternalHref, HrefKind, InternalHref, LinkDefinitionSet, MdDocumentLinksInfo, MdInlineLink, MdLink, MdLinkDefinition, MdLinkKind, MdLinkProvider } from '../document-links';
import { getExistingDefinitionBlock } from '../organize-linkdefs';
import { codeActionKindContains } from './util';

export class MdExtractLinkDefinitionCodeActionProvider {

	public static readonly genericTitle = l10n.t('Extract to link definition');

	static #kind = lsp.CodeActionKind.RefactorExtract + '.linkDefinition';

	public static readonly notOnLinkAction: lsp.CodeAction = {
		title: MdExtractLinkDefinitionCodeActionProvider.genericTitle,
		kind: MdExtractLinkDefinitionCodeActionProvider.#kind,
		disabled: {
			reason: l10n.t('Not on link'),
		}
	};

	public static readonly alreadyRefLinkAction: lsp.CodeAction = {
		title: MdExtractLinkDefinitionCodeActionProvider.genericTitle,
		kind: MdExtractLinkDefinitionCodeActionProvider.#kind,
		disabled: {
			reason: l10n.t('Link is already a reference'),
		}
	};

	readonly #linkProvider: MdLinkProvider;

	constructor(linkProvider: MdLinkProvider) {
		this.#linkProvider = linkProvider;
	}

	async getActions(doc: ITextDocument, range: lsp.Range, context: lsp.CodeActionContext, token: CancellationToken): Promise<lsp.CodeAction[]> {
		if (!this.#isEnabled(context)) {
			return [];
		}

		const linkInfo = await this.#linkProvider.getLinks(doc);
		if (token.isCancellationRequested) {
			return [];
		}

		const linksInRange = linkInfo.links.filter(link => link.kind !== MdLinkKind.Definition && rangeIntersects(range, link.source.range)) as MdInlineLink[];
		if (!linksInRange.length) {
			return [MdExtractLinkDefinitionCodeActionProvider.notOnLinkAction];
		}

		// Sort by range start to get most specific link
		linksInRange.sort((a, b) => comparePosition(b.source.range.start, a.source.range.start));

		// Even though multiple links may be in the selection, we only generate an action for the first link we find.
		// Creating actions for every link is overwhelming when users select all in a file
		const targetLink = linksInRange.find(link => link.href.kind === HrefKind.External || link.href.kind === HrefKind.Internal);
		if (!targetLink) {
			return [MdExtractLinkDefinitionCodeActionProvider.alreadyRefLinkAction];
		}

		return [this.#getExtractLinkAction(doc, linkInfo, targetLink as MdInlineLink<InternalHref | ExternalHref>)];
	}

	#isEnabled(context: lsp.CodeActionContext): boolean {
		if (typeof context.only === 'undefined') {
			return true;
		}

		return context.only.some(kind => codeActionKindContains(lsp.CodeActionKind.Refactor, kind));
	}

	#getExtractLinkAction(doc: ITextDocument, linkInfo: MdDocumentLinksInfo, targetLink: MdInlineLink<InternalHref | ExternalHref>): lsp.CodeAction {
		const builder = new WorkspaceEditBuilder();
		const resource = getDocUri(doc);
		const placeholder = this.#getPlaceholder(linkInfo.definitions);

		// Rewrite all inline occurrences of the link
		for (const link of linkInfo.links) {
			if (link.kind === MdLinkKind.Link && this.#matchesHref(targetLink.href, link)) {
				builder.replace(resource, link.source.targetRange, `[${placeholder}]`);
			}
		}

		// And append new definition to link definition block
		const definitionText = this.#getLinkTargetText(doc, targetLink).trim();
		const definitions = linkInfo.links.filter(link => link.kind === MdLinkKind.Definition) as MdLinkDefinition[];
		const defBlock = getExistingDefinitionBlock(doc, definitions);
		if (!defBlock) {
			builder.insert(resource, { line: doc.lineCount, character: 0 }, `\n\n[${placeholder}]: ${definitionText}`);
		} else {
			const line = getLine(doc, defBlock.endLine);
			builder.insert(resource, { line: defBlock.endLine, character: line.length }, `\n[${placeholder}]: ${definitionText}`);
		}

		const renamePosition = translatePosition(targetLink.source.targetRange.start, { characterDelta: 1 });
		return {
			title: MdExtractLinkDefinitionCodeActionProvider.genericTitle,
			kind: MdExtractLinkDefinitionCodeActionProvider.#kind,
			edit: builder.getEdit(),
			command: {
				command: 'vscodeMarkdownLanguageservice.rename',
				title: 'Rename',
				arguments: [getDocUri(doc), renamePosition],
			}
		};
	}

	#getLinkTargetText(doc: ITextDocument, link: MdInlineLink) {
		const afterHrefRange = makeRange(
			translatePosition(link.source.targetRange.start, { characterDelta: 1 }),
			translatePosition(link.source.targetRange.end, { characterDelta: -1 }));
		return doc.getText(afterHrefRange);
	}

	#getPlaceholder(definitions: LinkDefinitionSet): string {
		const base = 'def';
		for (let i = 1; ; ++i) {
			const name = i === 1 ? base : `${base}${i}`;
			if (typeof definitions.lookup(name) === 'undefined') {
				return name;
			}
		}
	}

	#matchesHref(href: InternalHref | ExternalHref, link: MdLink): boolean {
		if (link.href.kind === HrefKind.External && href.kind === HrefKind.External) {
			return link.href.uri.toString() === href.uri.toString();
		}

		if (link.href.kind === HrefKind.Internal && href.kind === HrefKind.Internal) {
			return link.href.path.toString() === href.path.toString() && link.href.fragment === href.fragment;
		}

		return false;
	}
}
