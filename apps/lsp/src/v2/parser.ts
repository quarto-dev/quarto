/*
 * parser.ts
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

import { ISlugifier } from './slugify';
import { ITextDocument } from './types/text-document';

export interface Token {
	readonly type: string;
	readonly markup: string;
	readonly content: string;
	readonly map: number[] | null;
	readonly children: readonly Token[] | null;
}

export interface TokenWithMap extends Token {
	readonly map: [number, number];
}

/**
 * Parses Markdown text into a stream of tokens.
 */
export interface IMdParser {

	/**
	 * The {@link ISlugifier slugifier} used for generating unique ids for headers in the Markdown.
	 */
	readonly slugifier: ISlugifier;
	
	/**
	 * Parse `document` into a stream of tokens.
	 */
	tokenize(document: ITextDocument): Promise<Token[]>;
}
