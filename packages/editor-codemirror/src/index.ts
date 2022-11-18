/*
 * index.ts
 *
 * Copyright (C) 2022 by Emergence Engineering (ISC License)
 * https://gitlab.com/emergence-engineering/prosemirror-codemirror-block
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

import { 
  ExtensionFn,
  CodeViewOptions,
  ExtensionContext
} from "editor"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function codeMirrorExtension(_codeViews: { [key: string]: CodeViewOptions }): ExtensionFn {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (_context: ExtensionContext) => {
    return null;
  }


}