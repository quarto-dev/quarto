/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token";
import containerPlugin from "markdown-it-container";
import * as vscode from "vscode";
import { MarkdownTextDocument } from "./document";
import { markdownitMathPlugin, markdownitFrontMatterPlugin } from "quarto-core";

const UNICODE_NEWLINE_REGEX = /\u2028|\u2029/g;

export class MarkdownEngine {
  private md?: MarkdownIt;

  private _tokenCache = new TokenCache();

  public constructor() {}

  public async parse(document: MarkdownTextDocument): Promise<Token[]> {
    const engine = await this.getEngine();
    const tokens = this.tokenizeDocument(document, engine);
    return tokens;
  }

  // will work only after the engine has been initialized elsewhere
  // (returns empty set of tokens if it hasn't)
  public parseSync(document: MarkdownTextDocument): Token[] {
    if (this.md) {
      const tokens = this.tokenizeDocument(document, this.md);
      return tokens;
    } else {
      return [];
    }
  }

  public cleanCache(): void {
    this._tokenCache.clean();
  }

  private async getEngine(): Promise<MarkdownIt> {
    if (!this.md) {
      this.md = MarkdownIt("zero");
      // tokenize blocks only
      this.md.enable([
        "blockquote",
        "code",
        "fence",
        "heading",
        "lheading",
        "html_block",
        "list",
        "paragraph",
        "hr",
        // exclude some blocks we don't care about
        // "reference",
      ]);
      this.md.use(markdownitMathPlugin, {
        enableInlines: false,
      });
      this.md.use(markdownitFrontMatterPlugin);
      this.md.use(containerPlugin, "", {
        validate: (_params: string) => {
          return true;
        },
      });
    }
    return this.md;
  }

  private tokenizeDocument(
    document: MarkdownTextDocument,
    engine: MarkdownIt
  ): Token[] {
    const cached = this._tokenCache.tryGetCached(document);
    if (cached) {
      return cached;
    }

    const tokens = this.tokenizeString(document.getText(), engine);
    this._tokenCache.update(document, tokens);
    return tokens;
  }

  private tokenizeString(text: string, engine: MarkdownIt) {
    return engine.parse(text.replace(UNICODE_NEWLINE_REGEX, ""), {});
  }
}

class TokenCache {
  private cachedDocument?: {
    readonly uri: vscode.Uri;
    readonly version: number;
  };
  private tokens?: Token[];

  public tryGetCached(document: MarkdownTextDocument): Token[] | undefined {
    if (
      this.cachedDocument &&
      this.cachedDocument.uri.toString() === document.uri.toString() &&
      this.cachedDocument.version === document.version
    ) {
      return this.tokens;
    }
    return undefined;
  }

  public update(document: MarkdownTextDocument, tokens: Token[]) {
    this.cachedDocument = {
      uri: document.uri,
      version: document.version,
    };
    this.tokens = tokens;
  }

  public clean(): void {
    this.cachedDocument = undefined;
    this.tokens = undefined;
  }
}
