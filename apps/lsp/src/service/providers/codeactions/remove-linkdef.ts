/*
 * remove-linkdef.ts
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
import * as lsp from 'vscode-languageserver-types';
import { makeRange, rangeIntersects, getDocUri, Document } from 'quarto-core';
import { WorkspaceEditBuilder } from '../../util/edit-builder';
import { DiagnosticCode } from '../diagnostics';
import { MdLinkDefinition } from '../document-links';
import { codeActionKindContains } from './util';


export class MdRemoveLinkDefinitionCodeActionProvider {

	static readonly #removeUnusedDefTitle = l10n.t('Remove unused link definition');
	static readonly #removeDuplicateDefTitle = l10n.t('Remove duplicate link definition');

	*getActions(doc: Document, range: lsp.Range, context: lsp.CodeActionContext): Iterable<lsp.CodeAction> {
		if (!this.#isEnabled(context)) {
			return;
		}

		const unusedDiagnosticLines = new Set<number>();

		for (const diag of context.diagnostics) {
			if (diag.code === DiagnosticCode.link_unusedDefinition && diag.data && rangeIntersects(diag.range, range)) {
				const link = diag.data as MdLinkDefinition;
				yield this.#getRemoveDefinitionAction(doc, link, MdRemoveLinkDefinitionCodeActionProvider.#removeUnusedDefTitle);
				unusedDiagnosticLines.add(link.source.range.start.line);
			}
		}

		for (const diag of context.diagnostics) {
			if (diag.code === DiagnosticCode.link_duplicateDefinition && diag.data && rangeIntersects(diag.range, range)) {
				const link = diag.data as MdLinkDefinition;
				if (!unusedDiagnosticLines.has(link.source.range.start.line)) {
					yield this.#getRemoveDefinitionAction(doc, link, MdRemoveLinkDefinitionCodeActionProvider.#removeDuplicateDefTitle);
				}
			}
		}
	}

	#isEnabled(context: lsp.CodeActionContext): boolean {
		if (typeof context.only === 'undefined') {
			return true;
		}

		return context.only.some(kind => codeActionKindContains(lsp.CodeActionKind.QuickFix, kind));
	}

	#getRemoveDefinitionAction(doc: Document, definition: MdLinkDefinition, title: string): lsp.CodeAction {
		const builder = new WorkspaceEditBuilder();

		const range = definition.source.range;
		builder.replace(getDocUri(doc), makeRange(range.start.line, 0, range.start.line + 1, 0), '');

		return { title, kind: lsp.CodeActionKind.QuickFix, edit: builder.getEdit() };
	}
}
