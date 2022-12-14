/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * display.ts
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


import { EditorDisplay, EditorMenuItem, XRef } from "editor";

import { Commands, showContextMenu } from "editor-ui";

export function editorDisplay(commands: () => Commands) : EditorDisplay {
  return {
    openURL(_url: string) {
      //
    },
    navigateToXRef(_file: string, _xref: XRef) {
      //
    },
    navigateToFile(_file: string) {
      //
    },

    async showContextMenu(
      items: EditorMenuItem[],
      clientX: number,
      clientY: number
    ): Promise<boolean> {
      return showContextMenu(commands(), items, clientX, clientY);
    }
  };
}
