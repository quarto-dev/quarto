/*
 * toc.ts
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

import { CancellationToken } from 'vscode-languageserver';
import * as lsp from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import { ILogger, LogLevel } from './logging';
import { IMdParser, Token } from './parser';
import { githubSlugifier, ISlugifier, Slug } from './slugify';
import { makeRange } from './types/range';
import { getDocUri, getLine, ITextDocument } from './types/text-document';
import { Disposable } from './util/dispose';
import { IWorkspace } from './workspace';
import { MdDocumentInfoCache } from './workspace-cache';

export interface TocEntry {
	readonly slug: Slug;
	readonly text: string;
	readonly level: number;
	readonly line: number;

	/**
	 * The entire range of the header section.
	 *
	* For the doc:
	 *
	 * ```md
	 * # Head #
	 * text
	 * # Next head #
	 * ```
	 *
	 * This is the range from `# Head #` to `# Next head #`
	 */
	readonly sectionLocation: lsp.Location;

	/**
	 * The range of the header declaration.
	 *
	 * For the doc:
	 *
	 * ```md
	 * # Head #
	 * text
	 * ```
	 *
	 * This is the range of `# Head #`
	 */
	readonly headerLocation: lsp.Location;

	/**
	 * The range of the header text.
	 *
	 * For the doc:
	 *
	 * ```md
	 * # Head #
	 * text
	 * ```
	 *
	 * This is the range of `Head`
	 */
	readonly headerTextLocation: lsp.Location;
}

export class TableOfContents {

	public static async create(parser: IMdParser, document: ITextDocument, token: CancellationToken): Promise<TableOfContents> {
		const entries = await this.#buildToc(parser, document, token);
		return new TableOfContents(entries, parser.slugifier);
	}

	public static async createForContainingDoc(parser: IMdParser, workspace: IWorkspace, document: ITextDocument, token: CancellationToken): Promise<TableOfContents> {
		const context = workspace.getContainingDocument?.(getDocUri(document));
		if (context) {
			const entries = (await Promise.all(Array.from(context.children, async cell => {
				const doc = await workspace.openMarkdownDocument(cell.uri);
				if (!doc || token.isCancellationRequested) {
					return [];
				}
				return this.#buildToc(parser, doc, token);
			}))).flat();
			return new TableOfContents(entries, parser.slugifier);
		}

		return this.create(parser, document, token);
	}

	static async #buildToc(parser: IMdParser, document: ITextDocument, token: CancellationToken): Promise<TocEntry[]> {
		const docUri = getDocUri(document);

		const toc: TocEntry[] = [];
		const tokens = await parser.tokenize(document);
		if (token.isCancellationRequested) {
			return [];
		}

		const existingSlugEntries = new Map<string, { count: number }>();

		type HeaderInfo = { open: Token; body: Token[] };

		const headers: HeaderInfo[] = [];
		let currentHeader: HeaderInfo | undefined;

		for (const token of tokens) {
			switch (token.type) {
				case 'heading_open': {
					currentHeader = { open: token, body: [] };
					headers.push(currentHeader);
					break;
				}
				case 'heading_close': {
					currentHeader = undefined;
					break;
				}
				default: {
					currentHeader?.body.push(token);
					break;
				}
			}
		}

		for (const { open, body } of headers) {
			if (!open.map) {
				continue;
			}

			const lineNumber = open.map[0];
			const line = getLine(document, lineNumber);
			const bodyText = TableOfContents.#getHeaderTitleAsPlainText(body);

			let slug = parser.slugifier.fromHeading(bodyText);
			const existingSlugEntry = existingSlugEntries.get(slug.value);
			if (existingSlugEntry) {
				++existingSlugEntry.count;
				slug = parser.slugifier.fromHeading(slug.value + '-' + existingSlugEntry.count);
			} else {
				existingSlugEntries.set(slug.value, { count: 0 });
			}

			const headerLocation: lsp.Location = {
				uri: docUri.toString(),
				range: makeRange(lineNumber, 0, lineNumber, line.length)
			};

			const headerTextLocation: lsp.Location = {
				uri: docUri.toString(),
				range: makeRange(lineNumber, line.match(/^#+\s*/)?.[0].length ?? 0, lineNumber, line.length - (line.match(/\s*#*$/)?.[0].length ?? 0))
			};

			toc.push({
				slug,
				text: line.replace(/^\s*#+\s*(.*?)(\s+#+)?$/, (_, word) => word.trim()),
				level: TableOfContents.#getHeaderLevel(open.markup),
				line: lineNumber,
				sectionLocation: headerLocation, // Populated in next steps
				headerLocation,
				headerTextLocation
			});
		}

		// Get full range of section
		return toc.map((entry, startIndex): TocEntry => {
			let end: number | undefined = undefined;
			for (let i = startIndex + 1; i < toc.length; ++i) {
				if (toc[i].level <= entry.level) {
					end = toc[i].line - 1;
					break;
				}
			}
			const endLine = end ?? document.lineCount - 1;
			return {
				...entry,
				sectionLocation: {
					uri: docUri.toString(),
					range: makeRange(
						entry.sectionLocation.range.start,
						{ line: endLine, character: getLine(document, endLine).length })
				}
			};
		});
	}

	static #getHeaderLevel(markup: string): number {
		if (markup === '=') {
			return 1;
		} else if (markup === '-') {
			return 2;
		} else { // '#', '##', ...
			return markup.length;
		}
	}

	static #tokenToPlainText(token: Token): string {
		if (token.children) {
			return token.children.map(TableOfContents.#tokenToPlainText).join('');
		}

		switch (token.type) {
			case 'text':
			case 'emoji':
			case 'code_inline':
				return token.content;
			default:
				return '';
		}
	}

	static #getHeaderTitleAsPlainText(headerTitleParts: readonly Token[]): string {
		return headerTitleParts
			.map(TableOfContents.#tokenToPlainText)
			.join('')
			.trim();
	}

	public static readonly empty = new TableOfContents([], githubSlugifier);

	readonly #slugifier: ISlugifier;

	private constructor(
		public readonly entries: readonly TocEntry[],
		slugifier: ISlugifier,
	) {
		this.#slugifier = slugifier;
	}

	public lookup(fragment: string): TocEntry | undefined {
		const slug = this.#slugifier.fromHeading(fragment);
		return this.entries.find(entry => entry.slug.equals(slug));
	}
}


export class MdTableOfContentsProvider extends Disposable {

	readonly #cache: MdDocumentInfoCache<TableOfContents>;

	readonly #parser: IMdParser;
	readonly #workspace: IWorkspace;
	readonly #logger: ILogger;

	constructor(
		parser: IMdParser,
		workspace: IWorkspace,
		logger: ILogger,
	) {
		super();

		this.#parser = parser;
		this.#workspace = workspace;
		this.#logger = logger;

		this.#cache = this._register(new MdDocumentInfoCache<TableOfContents>(workspace, (doc, token) => {
			this.#logger.log(LogLevel.Debug, 'TableOfContentsProvider.create', { document: doc.uri, version: doc.version });
			return TableOfContents.create(parser, doc, token);
		}));
	}

	public async get(resource: URI): Promise<TableOfContents> {
		return await this.#cache.get(resource) ?? TableOfContents.empty;
	}

	public getForDocument(doc: ITextDocument): Promise<TableOfContents> {
		return this.#cache.getForDocument(doc);
	}

	public getForContainingDoc(doc: ITextDocument, token: CancellationToken): Promise<TableOfContents> {
		return TableOfContents.createForContainingDoc(this.#parser, this.#workspace, doc, token);
	}
}
