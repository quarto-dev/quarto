/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LLICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { MarkdownEngine } from "./engine";
import { isQuartoDoc } from "../core/doc";
import { pandocAutoIdentifier } from "./auto-id";
import { MarkdownTextDocument } from "./document";
import { parseFrontMatterStr } from "../core/yaml";
import { isExecutableLanguageBlock } from "./language";

export enum TocEntryType {
  Title,
  Heading,
  CodeCell,
}

export interface TocEntry {
  readonly type: TocEntryType;
  readonly slug?: string;
  readonly text: string;
  readonly level: number;
  readonly line: number;
  readonly location: vscode.Location;
}

export function getHeaderLevel(markup: string): number {
  if (markup === "=") {
    return 1;
  } else if (markup === "-") {
    return 2;
  } else {
    // '#', '##', ...
    return markup.length;
  }
}

export class MarkdownTableOfContents {
  public static async create(
    engine: MarkdownEngine,
    document: MarkdownTextDocument
  ): Promise<MarkdownTableOfContents> {
    const entries = await this.buildToc(engine, document);
    return new MarkdownTableOfContents(entries);
  }

  public static async createForDocumentOrNotebook(
    engine: MarkdownEngine,
    document: MarkdownTextDocument
  ): Promise<MarkdownTableOfContents> {
    if (document.uri.scheme === "vscode-notebook-cell") {
      const notebook = vscode.workspace.notebookDocuments.find((notebook) =>
        notebook.getCells().some((cell) => cell.document === document)
      );

      if (notebook) {
        const entries: TocEntry[] = [];

        for (const cell of notebook.getCells()) {
          if (
            cell.kind === vscode.NotebookCellKind.Markup &&
            isQuartoDoc(cell.document)
          ) {
            entries.push(...(await this.buildToc(engine, cell.document)));
          }
        }

        return new MarkdownTableOfContents(entries);
      }
    }

    return this.create(engine, document);
  }

  private constructor(public readonly entries: readonly TocEntry[]) {}

  public lookup(fragment: string): TocEntry | undefined {
    const slug = pandocAutoIdentifier(fragment, false);
    return this.entries.find((entry) => entry.slug === slug);
  }

  private static async buildToc(
    engine: MarkdownEngine,
    document: MarkdownTextDocument
  ): Promise<TocEntry[]> {
    const kFrontMatter = "front_matter";
    const kHeadingOpen = "heading_open";
    const kFence = "fence";
    const kContainerOpen = "container__open";
    const kContainerClose = "container__close";

    const toc: TocEntry[] = [];
    const tokens = await engine.parse(document);

    const existingSlugEntries = new Map<string, { count: number }>();
    let lastLevel = 2;
    let callout = 0;
    for (const token of tokens.filter((token) =>
      [
        kFrontMatter,
        kHeadingOpen,
        kFence,
        kContainerOpen,
        kContainerClose,
      ].includes(token.type)
    )) {
      // track whether we are in a callout (skip if we are)
      if (token.type === kContainerOpen) {
        if (token.info.includes(".callout-") || callout > 0) {
          callout++;
        }
      } else if (token.type === kContainerClose) {
        if (callout > 0) {
          callout--;
        }
      }
      if (callout > 0) {
        continue;
      }

      if (!token.map) {
        continue;
      }

      const lineNumber = token.map[0];
      const line = document.lineAt(lineNumber);

      if (token.type === kHeadingOpen) {
        lastLevel = getHeaderLevel(token.markup);

        let slug = pandocAutoIdentifier(line.text);
        const existingSlugEntry = existingSlugEntries.get(slug);
        if (existingSlugEntry) {
          ++existingSlugEntry.count;
          slug = pandocAutoIdentifier(slug + "-" + existingSlugEntry.count);
        } else {
          existingSlugEntries.set(slug, { count: 0 });
        }
        toc.push({
          type: TocEntryType.Heading,
          slug,
          text: MarkdownTableOfContents.getHeaderText(line.text),
          level: lastLevel,
          line: lineNumber,
          location: new vscode.Location(
            document.uri,
            new vscode.Range(lineNumber, 0, lineNumber, line.text.length)
          ),
        });
      } else if (token.type === kFrontMatter) {
        const meta = parseFrontMatterStr(token.markup);
        if (meta?.["title"]) {
          toc.push({
            type: TocEntryType.Title,
            text: meta["title"],
            level: 2,
            line: lineNumber,
            location: new vscode.Location(
              document.uri,
              new vscode.Range(
                lineNumber,
                0,
                lineNumber + token.markup.split("\n").length - 1,
                0
              )
            ),
          });
        }
      } else if (token.type === kFence) {
        if (isExecutableLanguageBlock(token)) {
          const match = token.content.match(/(?:#|\/\/|)\| label:\s+(.+)/);
          if (match && token.map) {
            toc.push({
              type: TocEntryType.CodeCell,
              text: match[1],
              level: lastLevel + 1,
              line: lineNumber,
              location: new vscode.Location(
                document.uri,
                new vscode.Range(lineNumber, 0, token.map[1] - 1, 0)
              ),
            });
          }
        }
      }
    }

    // Get full range of section
    return toc.map((entry, startIndex): TocEntry => {
      if (entry.type == TocEntryType.Heading) {
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
          location: new vscode.Location(
            document.uri,
            new vscode.Range(
              entry.location.range.start,
              new vscode.Position(endLine, document.lineAt(endLine).text.length)
            )
          ),
        };
      } else {
        return entry;
      }
    });
  }

  private static getHeaderText(header: string): string {
    return header.replace(/^\s*#+\s*(.*?)(\s+#+)?$/, (_, word) => word.trim());
  }
}
