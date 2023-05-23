/*
 * token.ts
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

import { Range } from '../range';

export type PandocTokenType =
  | "BlockQuote"
  | "BulletList"
  | "CodeBlock"
  | "Div"
  | "Header"
  | "HorizontalRule"
  | "OrderedList"
  | "Para"
  | "RawBlock"
  | "Table"
  | "Code"
  | "Image"
  | "Link"
  | "Math"
  | "Note"
  | "RawInline"
  | "Span";

export interface PandocAttr {
  id: string;
  classes: string[];
  keyvalue: Array<[string, string]>;
}

export interface PandocToken {
  readonly type: PandocTokenType;
  range: Range;
  attr?: PandocAttr; 
  data?: unknown;
    // Header: text
    // Image: caption
    // Link: target
    // Math: type
    // CodeBlock: text
}


