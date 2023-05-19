/*
 * edit-builder.ts
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

import * as lsp from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';

export class WorkspaceEditBuilder {

	readonly #changes: { [uri: lsp.DocumentUri]: lsp.TextEdit[]; } = {};
	readonly #documentChanges: Array<lsp.CreateFile | lsp.RenameFile | lsp.DeleteFile> = [];

	replace(resource: URI, range: lsp.Range, newText: string): void {
		this.#addEdit(resource, lsp.TextEdit.replace(range, newText));
	}

	insert(resource: URI, position: lsp.Position, newText: string): void {
		this.#addEdit(resource, lsp.TextEdit.insert(position, newText));
	}

	#addEdit(resource: URI, edit: lsp.TextEdit): void {
		const resourceKey = resource.toString();
		let edits = this.#changes![resourceKey];
		if (!edits) {
			edits = [];
			this.#changes![resourceKey] = edits;
		}

		edits.push(edit);
	}

	getEdit(): lsp.WorkspaceEdit {
		// We need to convert changes into `documentChanges` or else they get dropped
		const textualChanges = Object.entries(this.#changes).map(([uri, edits]): lsp.TextDocumentEdit => {
			return lsp.TextDocumentEdit.create({ uri, version: null }, edits);
		});

		return {
			documentChanges: [...textualChanges, ...this.#documentChanges],
		};
	}

	renameFile(targetUri: URI, resolvedNewFilePath: URI) {
		this.#documentChanges.push(lsp.RenameFile.create(targetUri.toString(), resolvedNewFilePath.toString()));
	}
}