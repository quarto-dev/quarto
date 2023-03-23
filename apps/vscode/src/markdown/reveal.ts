/*
 * reveal.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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

import { Position, TextDocument } from "vscode";

import { markdownitFrontMatterPlugin, parseFrontMatterStr } from "quarto-core";

import { tokenizeMarkdownString } from "./engine";
import { getHeaderLevel } from "./toc";
import MarkdownIt from "markdown-it";

export async function revealSlideIndex(
  cursorPos: Position,
  doc: TextDocument
) {
  const location = await revealEditorLocation(cursorPos, doc);
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
  doc: TextDocument
): Promise<RevealEditorLocation> {
  const items: RevealEditorLocationItem[] = [];
  let explicitSlideLevel: number | null = null;
  let foundCursor = false;
  const tokens = tokenizeMarkdownString(doc.getText(), revealSlidesMarkdownEngine());
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

function revealSlidesMarkdownEngine() {
  const engine =  MarkdownIt("zero");
  engine.enable([
    "heading",
    "lheading",
    "hr",
    // needs code block tokens so it can ignore headings, etc. inside code
    "code", 
    "fence",
    "html_block"
  ]);
  engine.use(markdownitFrontMatterPlugin);
  return engine;
}

function slideLevelFromYaml(str: string) {
  try {
    const meta = parseFrontMatterStr(str) as any;
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
