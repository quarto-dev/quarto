/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * editor-dialogs.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { 
  CalloutEditProps, 
  CalloutEditResult, 
  CodeBlockEditResult, 
  CodeBlockProps, 
  EditorDialogs, 
  EditorHTMLDialogCreateFn, 
  EditorHTMLDialogValidateFn, 
  InsertCiteProps, 
  InsertCiteResult, 
  InsertTabsetResult, 
} from "editor";

import EditorDialogsImpl from "./EditorDialogsImpl";

export function editorDialogs(dialogs: EditorDialogsImpl) : EditorDialogs {
  
    return {
      alert: dialogs.alert.bind(dialogs),
      
      // TODO
      async yesNoMessage(
        _message: string,
        _title: string,
        _type: number,
        _yesLabel: string,
        _noLabel: string
      ): Promise<boolean> {
        return false;
      },
      editLink: dialogs.editLink.bind(dialogs),
     
      editImage: dialogs.editImage.bind(dialogs),

      // TODO
      async editCodeBlock(
        _codeBlock: CodeBlockProps,
        _attributes: boolean,
        _languages: string[]
      ): Promise<CodeBlockEditResult | null> {
        return null;
      },

      editList: dialogs.editList.bind(dialogs),

      editAttr: dialogs.editAttr.bind(dialogs),
      editSpan: dialogs.editSpan.bind(dialogs),
      editDiv: dialogs.editDiv.bind(dialogs),

      // TODO
      async editCallout(
        _props: CalloutEditProps,
        _removeEnabled: boolean
      ): Promise<CalloutEditResult | null> {
        return null;
      },

      editRawInline: dialogs.editRawInline.bind(dialogs),
      editRawBlock: dialogs.editRawBlock.bind(dialogs),

      // TODO
      async editMath(_id: string): Promise<string | null> {
        return null;
      },

      insertTable: dialogs.insertTable.bind(dialogs),

      // TODO
      async insertTabset(): Promise<InsertTabsetResult | null> {
        return null;
      },

      // TODO
      async insertCite(
        _props: InsertCiteProps
      ): Promise<InsertCiteResult | null> {
        return null;
      },

      // TODO
      async htmlDialog(
        _title: string,
        _okText: string | null,
        _create: EditorHTMLDialogCreateFn,
        _focus: VoidFunction,
        _validate: EditorHTMLDialogValidateFn
      ): Promise<boolean> {
        return false;
      },
    };
}