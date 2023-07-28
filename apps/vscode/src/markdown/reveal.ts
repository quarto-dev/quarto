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

import { QuartoContext, isFrontMatter, isHeader, parseFrontMatterStr, quartoProjectConfig } from "quarto-core";
import { MarkdownEngine } from "./engine";


export async function revealSlideIndex(
  cursorPos: Position,
  doc: TextDocument,
  engine: MarkdownEngine,
  context: QuartoContext
) {
  const location = await revealEditorLocation(cursorPos, doc, engine, context);
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
  engine: MarkdownEngine,
  context: QuartoContext
): Promise<RevealEditorLocation> {
  const items: RevealEditorLocationItem[] = [];

  let explicitSlideLevel: number | null = null;
  let foundCursor = false;
  const tokens = engine.parse(doc);
  for (const token of tokens) {
    // if the cursor is before this token then add the cursor item
    const row = token.range.start.line;
    if (!foundCursor && cursorPos.line < row) {
      foundCursor = true;
      items.push(cursorItem(cursorPos.line));
    }
    if (isFrontMatter(token)) {
      explicitSlideLevel = slideLevelFromYaml(token.data);
      items.push(titleItem(0));
    } else if (token.type === "HorizontalRule") {
      items.push(hrItem(row));
    } else if (isHeader(token)) {
      const level = token.data.level;
      items.push(headingItem(row, level));
    } 
  }

  // put cursor at end if its not found
  if (!foundCursor) {
    items.push(cursorItem(doc.lineCount - 1));
  }

  // if there is no title then insert a title token if there is a title in the project yaml
  if (!items.find(item => item.type === kTitle)) {
    const config = await quartoProjectConfig(context.runQuarto, doc.uri.fsPath);
    if (config?.config.title) {
      items.unshift(titleItem(0));
    }
  }

  return { items, slideLevel: explicitSlideLevel || 2 };
}


function getHeaderLevel(markup: string): number {
  if (markup === "=") {
    return 1;
  } else if (markup === "-") {
    return 2;
  } else {
    // '#', '##', ...
    return markup.length;
  }
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
