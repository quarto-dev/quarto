/*
 * text-document.ts
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

import { Position, Range } from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import { makeRange } from 'quarto-core';

/**
 * A document in the workspace.
 */
export interface ITextDocument {
	/**
	 * The uri of the document, as a string.
	 */
	readonly uri: string;

	/**
	 * The uri of the document, as a URI. 
	 */
	readonly $uri?: URI;
	
	/**
	 * The lanugageId of the document
	 */
	readonly languageId : string | undefined;

	/**
	 * Version number of the document's content. 
	 */
	readonly version: number;

	/**
	 * The total number of lines in the document.
	 */
	readonly lineCount: number;

	/**
	 * Get text contents of the document.
	 * 
	 * @param range Optional range to get the text of. If not specified, the entire document content is returned.
	 */
	getText(range?: Range): string;

	/**
	 * Converts an offset in the document into a {@link Position position}.
	 */
	positionAt(offset: number): Position;
}

export function getLine(doc: ITextDocument, line: number): string {
	return doc.getText(makeRange(line, 0, line, Number.MAX_VALUE)).replace(/\r?\n$/, '');
}

export function getDocUri(doc: ITextDocument): URI {
	return doc.$uri ?? URI.parse(doc.uri);
}