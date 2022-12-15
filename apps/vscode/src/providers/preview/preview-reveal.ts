/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Position, TextDocument } from "vscode";

import { MarkdownEngine } from "../../markdown/engine";
import { getHeaderLevel } from "../../markdown/toc";
import { parseFrontMatterStr } from "../../core/yaml";

export async function revealSlideIndex(
  cursorPos: Position,
  doc: TextDocument,
  engine: MarkdownEngine
) {
  const location = await revealEditorLocation(cursorPos, doc, engine);
  let slideIndex = -1;
  for (const item of location.items) {
    if (item.type === kCursor) {
      return Math.max(slideIndex, 0);
    } else if (item.type === kTitle || item.type === kHr) {
      slideIndex++;
    } else if (item.type === kHeading && item.level <= location.slideLevel) {
      slideIndex++;
    }
  }
  return 0;
}

const kTitle = "title";
const kHeading = "heading";
const kHr = "hr";
const kCursor = "cursor";

interface RevealEditorLocation {
  items: RevealEditorLocationItem[];
  slideLevel: number;
}

type RevealEditorLocationItemType =
  | typeof kTitle
  | typeof kHeading
  | typeof kHr
  | typeof kCursor;

interface RevealEditorLocationItem {
  type: RevealEditorLocationItemType;
  level: number;
  row: number;
}

async function revealEditorLocation(
  cursorPos: Position,
  doc: TextDocument,
  engine: MarkdownEngine
): Promise<RevealEditorLocation> {
  const items: RevealEditorLocationItem[] = [];
  let explicitSlideLevel: number | null = null;
  let foundCursor = false;
  const tokens = await engine.parse(doc);
  for (const token of tokens) {
    if (token.map) {
      // if the cursor is before this token then add the cursor item
      const row = token.map[0];
      if (!foundCursor && cursorPos.line < row) {
        foundCursor = true;
        items.push(cursorItem(cursorPos.line));
      }
      if (token.type === "front_matter") {
        explicitSlideLevel = slideLevelFromYaml(token.markup);
        items.push(titleItem(0));
      } else if (token.type === "hr") {
        items.push(hrItem(row));
      } else if (token.type === "heading_open") {
        const level = getHeaderLevel(token.markup);
        items.push(headingItem(row, level));
      }
    }
  }

  // put cursor at end if its not found
  if (!foundCursor) {
    items.push(cursorItem(doc.lineCount - 1));
  }

  return { items, slideLevel: explicitSlideLevel || 2 };
}

function slideLevelFromYaml(str: string) {
  try {
    const meta = parseFrontMatterStr(str);
    if (meta) {
      const kSlideLevel = "slide-level";
      return (
        meta[kSlideLevel] || meta["format"]?.["revealjs"]?.[kSlideLevel] || null
      );
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

function titleItem(row: number): RevealEditorLocationItem {
  return simpleItem(kTitle, row);
}

function cursorItem(row: number): RevealEditorLocationItem {
  return simpleItem(kCursor, row);
}

function hrItem(row: number): RevealEditorLocationItem {
  return simpleItem(kHr, row);
}

function headingItem(row: number, level: number): RevealEditorLocationItem {
  return {
    type: kHeading,
    level,
    row,
  };
}

function simpleItem(
  type: RevealEditorLocationItemType,
  row: number
): RevealEditorLocationItem {
  return {
    type,
    level: 0,
    row,
  };
}
