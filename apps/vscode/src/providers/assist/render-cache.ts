/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) 2020 Matt Bierner
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, Range, TextEditor } from "vscode";

export type RenderCacheKey = typeof renderCacheKeyNone | EditorRenderCacheKey;

export const renderCacheKeyNone = { type: "none" } as const;

export function createRenderCacheKey(
  editor: TextEditor | undefined
): RenderCacheKey {
  if (!editor) {
    return renderCacheKeyNone;
  }

  return new EditorRenderCacheKey(
    editor.document.uri,
    editor.document.version,
    editor.document.getWordRangeAtPosition(editor.selection.active)
  );
}

export function renderCacheKeyEquals(
  a: RenderCacheKey,
  b: RenderCacheKey
): boolean {
  if (a === b) {
    return true;
  }

  if (a.type !== b.type) {
    return false;
  }

  if (a.type === "none" || b.type === "none") {
    return false;
  }

  return a.equals(b);
}

export class EditorRenderCacheKey {
  readonly type = "editor";

  constructor(
    public readonly url: Uri,
    public readonly version: number,
    public readonly wordRange: Range | undefined
  ) {}

  public equals(other: EditorRenderCacheKey): boolean {
    if (this.url.toString() !== other.url.toString()) {
      return false;
    }

    if (this.version !== other.version) {
      return false;
    }

    if (!other.wordRange || !this.wordRange) {
      return false;
    }

    if (other.wordRange === this.wordRange) {
      return true;
    }

    return this.wordRange.isEqual(other.wordRange);
  }
}
