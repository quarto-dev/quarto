/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Token from "markdown-it/lib/token";
import * as vscode from "vscode";
import { MarkdownEngine } from "../markdown/engine";
import { MarkdownTableOfContents } from "../markdown/toc";

const rangeLimit = 5000;

interface MarkdownItTokenWithMap extends Token {
  map: [number, number];
}

export default class QuartoFoldingProvider
  implements vscode.FoldingRangeProvider
{
  constructor(private readonly engine: MarkdownEngine) {}

  public async provideFoldingRanges(
    document: vscode.TextDocument,
    _: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.FoldingRange[]> {
    const foldables = await Promise.all([
      this.getRegions(document),
      this.getHeaderFoldingRanges(document),
      this.getBlockFoldingRanges(document),
      this.getDivFoldingRanges(document),
      this.getFrontMatterFoldingRanges(document),
    ]);
    return foldables.flat().slice(0, rangeLimit);
  }

  private async getRegions(
    document: vscode.TextDocument
  ): Promise<vscode.FoldingRange[]> {
    const tokens = await this.engine.parse(document);
    const regionMarkers = tokens.filter(isRegionMarker).map((token) => ({
      line: token.map[0],
      isStart: isStartRegion(token.content),
    }));

    const nestingStack: { line: number; isStart: boolean }[] = [];
    return regionMarkers
      .map((marker) => {
        if (marker.isStart) {
          nestingStack.push(marker);
        } else if (
          nestingStack.length &&
          nestingStack[nestingStack.length - 1].isStart
        ) {
          return new vscode.FoldingRange(
            nestingStack.pop()!.line,
            marker.line,
            vscode.FoldingRangeKind.Region
          );
        } else {
          // noop: invalid nesting (i.e. [end, start] or [start, end, end])
        }
        return null;
      })
      .filter(
        (region: vscode.FoldingRange | null): region is vscode.FoldingRange =>
          !!region
      );
  }

  private async getHeaderFoldingRanges(document: vscode.TextDocument) {
    const toc = await MarkdownTableOfContents.create(this.engine, document);
    return toc.entries.map((entry) => {
      let endLine = entry.location.range.end.line;
      if (
        document.lineAt(endLine).isEmptyOrWhitespace &&
        endLine >= entry.line + 1
      ) {
        endLine = endLine - 1;
      }
      return new vscode.FoldingRange(entry.line, endLine);
    });
  }

  private async getDivFoldingRanges(document: vscode.TextDocument) {
    const tokens = await this.engine.parse(document);
    const divTokens = tokens.filter(
      (token) => token.type === "container__open"
    );
    return divTokens
      .filter((token) => !!token.map)
      .map((token) => {
        return new vscode.FoldingRange(token.map![0], token.map![1]);
      });
  }

  private async getFrontMatterFoldingRanges(document: vscode.TextDocument) {
    const tokens = await this.engine.parse(document);
    const fmTokens = tokens.filter((token) => token.type === "front_matter");
    return fmTokens
      .filter((token) => !!token.map)
      .map((token) => {
        return new vscode.FoldingRange(
          token.map![0] + 1,
          token.map![0] + token.markup.split("\n").length - 2
        );
      });
  }

  private async getBlockFoldingRanges(
    document: vscode.TextDocument
  ): Promise<vscode.FoldingRange[]> {
    const tokens = await this.engine.parse(document);
    const multiLineListItems = tokens.filter(isFoldableToken);
    return multiLineListItems.map((listItem) => {
      const start = listItem.map[0];
      let end = listItem.map[1] - 1;
      if (document.lineAt(end).isEmptyOrWhitespace && end >= start + 1) {
        end = end - 1;
      }
      return new vscode.FoldingRange(
        start,
        end,
        this.getFoldingRangeKind(listItem)
      );
    });
  }

  private getFoldingRangeKind(
    listItem: Token
  ): vscode.FoldingRangeKind | undefined {
    return listItem.type === "html_block" && listItem.content.startsWith("<!--")
      ? vscode.FoldingRangeKind.Comment
      : undefined;
  }
}

const isStartRegion = (t: string) => /^\s*<!--\s*#?region\b.*-->/.test(t);
const isEndRegion = (t: string) => /^\s*<!--\s*#?endregion\b.*-->/.test(t);

const isRegionMarker = (token: Token): token is MarkdownItTokenWithMap =>
  !!token.map &&
  token.type === "html_block" &&
  (isStartRegion(token.content) || isEndRegion(token.content));

const isFoldableToken = (token: Token): token is MarkdownItTokenWithMap => {
  if (!token.map) {
    return false;
  }

  switch (token.type) {
    case "fence":
    case "list_item_open":
      return token.map[1] > token.map[0];

    case "html_block":
      if (isRegionMarker(token)) {
        return false;
      }
      return token.map[1] > token.map[0] + 1;

    default:
      return false;
  }
};
