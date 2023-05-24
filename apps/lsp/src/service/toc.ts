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

import { Disposable } from 'core';
import { PandocToken, makeRange, parseFrontMatterStr } from 'quarto-core';

import { ILogger, LogLevel } from './logging';
import { IMdParser } from './parser';
import { pandocSlugifier, ISlugifier, Slug } from './slugify';
import { getDocUri, getLine, ITextDocument } from './document';

import { IWorkspace } from './workspace';
import { MdDocumentInfoCache } from './workspace-cache';
import { isExecutableLanguageBlock } from 'quarto-core/src/pandoc/language';

export enum TocEntryType { Title, Header, CodeCell };

export interface TocEntry {
	readonly type: TocEntryType;
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
}

export interface TocHeaderEntry extends TocEntry {
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

export function isTocHeaderEntry(entry?: TocEntry): entry is TocHeaderEntry {
	return entry !== undefined && 
	       'headerLocation' in entry && 
				 'headerTextLocation' in entry;
}

export class TableOfContents {

	public static async create(parser: IMdParser, document: ITextDocument, token: CancellationToken): Promise<TableOfContents> {
		const entries = await this.#buildPandocToc(parser, document, token);
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
				return this.#buildPandocToc(parser, doc, token);
			}))).flat();
			return new TableOfContents(entries, parser.slugifier);
		}

		return this.create(parser, document, token);
	}

	static async #buildPandocToc(parser: IMdParser, document: ITextDocument, token: CancellationToken): Promise<TocEntry[]> {

		const docUri = getDocUri(document);

		const toc: TocEntry[] = [];
		const tokens = await parser.parsePandocTokens(document);
		if (token.isCancellationRequested) {
			return [];
		}

		const existingSlugEntries = new Map<string, { count: number }>();

		const toSlug = (text: string) => {
			let slug = parser.slugifier.fromHeading(text);
			const existingSlugEntry = existingSlugEntries.get(slug.value);
			if (existingSlugEntry) {
				++existingSlugEntry.count;
				slug = parser.slugifier.fromHeading(slug.value + '-' + existingSlugEntry.count);
			} else {
				existingSlugEntries.set(slug.value, { count: 0 });
			}
			return slug;
		}

		const asLocation = (range: lsp.Range) : lsp.Location => {
			return {
				uri: docUri.toString(),
				range
			}
		}

		const maxHeadingLevel = tokens.reduce((max: number, element: PandocToken) => {
			return element.level && element.level < max ? element.level : max;
		}, 2);

		let lastLevel = 2;

		for (let i=0; i<tokens.length; i++) {
			const token = tokens[i];
			if (token.type === "FrontMatter") {
				 // eslint-disable-next-line @typescript-eslint/no-explicit-any
				 const meta = parseFrontMatterStr(token.data as string) as any;
				 if (typeof(meta) === "object" && typeof(meta.title) === "string") {
					toc.push({
						type: TocEntryType.Title,
						slug: toSlug(meta.title),
						text: meta.title,
						level: maxHeadingLevel,
						line: token.range.start.line,
						sectionLocation: asLocation(token.range),
					})
				 }
			} else if (token.type === "Header") {

				// type
				const type = TocEntryType.Header;

				// text
				const text = token.data as string;

				// slug 
				const slug = toSlug(text);
			
				// line
				const line = token.range.start.line;

				// level
				const level = token.level!;
				lastLevel = level;

				// sectionLocation
				const sectionStart = token.range.start;
				const nextPeerElement = tokens.slice(i+1).find(el => el.level && (el.level <= level));
				const sectionEndLine = nextPeerElement ? nextPeerElement.range.start.line-1 : (document.lineCount-1);
				const sectionEndCharacter = getLine(document, sectionEndLine).length;
				const sectionLocation = makeRange(sectionStart, lsp.Position.create(sectionEndLine, sectionEndCharacter));

				// headerLocation
				const headerLocation = token.range;
				if (headerLocation.end.character === 0) {
					headerLocation.end.line--;
					headerLocation.end.character = getLine(document, headerLocation.end.line).length;
				}

				// headerTextLocation
				let headerTextLocation = token.range;
				const headerLine = getLine(document, line);
				const headerTextMatch = headerLine.match(/(^#*\s+)([^{]+)/);
				if (headerTextMatch) {
					headerTextLocation = makeRange(
						lsp.Position.create(token.range.start.line, headerTextMatch[1].length), 
						lsp.Position.create(token.range.start.line, headerTextMatch[0].length))
				}

				const tocEntry: TocHeaderEntry = {
					type,
					slug,
					text,
					level,
					line,
					sectionLocation: asLocation(sectionLocation),
					headerLocation: asLocation(headerLocation),
					headerTextLocation: asLocation(headerTextLocation)
				}

				toc.push(tocEntry);

			} else if (isExecutableLanguageBlock(token)) {
				const match = (token.data as string).match(/(?:#|\/\/|)\| label:\s+(.+)/);
				if (match) {
					toc.push({
						type: TocEntryType.CodeCell,
						slug: toSlug(match[1]),
						text: match[1],
						level: lastLevel,
						line: token.range.start.line,
						sectionLocation: asLocation(token.range),
					})
				}
			}
		}

		return toc;
	}


	public static readonly empty = new TableOfContents([], pandocSlugifier);

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
