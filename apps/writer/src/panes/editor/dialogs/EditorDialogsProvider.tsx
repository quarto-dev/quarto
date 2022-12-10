/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * EditorDialogsProvider.tsx
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

import React, { PropsWithChildren, useRef, useState } from "react";

import { t } from '../../../i18n';

import {
  ImageProps,
  ImageDimensions,
  EditorDialogs,
  InsertCiteProps,
  EditorHTMLDialogCreateFn,
  EditorHTMLDialogValidateFn,
  InsertCiteResult,
  InsertTabsetResult,
  ImageEditResult,
  UITools
} from 'editor';

import { alert, editAttr, editCallout, editCodeBlock, editDivAttr, editLink, editList, editMath, editRawBlock, editRawInline, insertTable, yesNoMessage } from "editor-dialogs";

import { defaultEditImageProps, EditorDialogEditImage, EditorDialogEditImageProps } from "./EditorDialogEditImage";

interface EditorDialogsState {
  editImage: EditorDialogEditImageProps;
}

export const EditorDialogsContext = React.createContext<EditorDialogs>(null!);

export const EditorDialogsProvider: React.FC<PropsWithChildren> = (props) => {

  const uiToolsRef = useRef<UITools>(new UITools());

  const [state, setState] = useState<EditorDialogsState>({
    editImage: defaultEditImageProps()
  });

  const editorDialogsProvider: EditorDialogs = {
    alert,
   
    yesNoMessage,

    editLink: editLink(uiToolsRef.current.attr),

    async editImage(image: ImageProps, dims: ImageDimensions | null, _figure: boolean, editAttributes: boolean): Promise<ImageProps | null> {
      return new Promise(resolve => {
        setState(prevState => ({
          ...prevState,
          editImage: {
            isOpen: true,
            image,
            dims,
            editAttributes,
            onClosed: (result: ImageEditResult | null) => {
              setState({ ...prevState, editImage: { ...state.editImage, isOpen: false } });
              resolve(result);
            },
          },
        }));
      });
    },

    editCodeBlock: editCodeBlock(uiToolsRef.current.attr),

    editList,

    editAttr: editAttr(uiToolsRef.current.attr),

    editSpan: editAttr(uiToolsRef.current.attr, { 
      caption: t('edit_span_dialog_caption') as string,
      removeEnabled: true, 
      removeCaption: t('edit_span_dialog_remove_caption') as string
    }),
   
    editDiv: editDivAttr(uiToolsRef.current.attr, {
      caption: t('edit_div_dialog_caption') as string,
      removeCaption: t('edit_div_dialog_remove_caption') as string
    }),
    
    editCallout: editCallout(uiToolsRef.current.attr),
    
    editRawInline,

    editRawBlock,
    
    editMath,
    
    insertTable,

    async insertTabset(): Promise<InsertTabsetResult | null> {
      return null;
    },
    async insertCite(_props: InsertCiteProps): Promise<InsertCiteResult | null> {
      return null;
    },
    async htmlDialog(_title: string, _okText: string | null, _create: EditorHTMLDialogCreateFn, _focus: VoidFunction, _validate: EditorHTMLDialogValidateFn): Promise<boolean> {
      return false;
    }
  };

  return (
    <EditorDialogsContext.Provider value={editorDialogsProvider}>
      {props.children}
      <EditorDialogEditImage {...state.editImage} />
    </EditorDialogsContext.Provider> 
  );

}
