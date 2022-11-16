/*
 * EditorDialogEditorAttr.tsx
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

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@blueprintjs/core';

import { AttrEditResult, AttrProps } from 'editor';

import { Dialog } from '../../../widgets/dialog/Dialog';

import { AttrEditor } from './AttrEditor';

export interface EditorDialogEditAttrProps {
  attr: AttrProps;
  removeEnabled?: boolean;
  caption?: string;
  removeCaption?: string;
  isOpen: boolean;
  onClosed: (result: AttrEditResult | null) => void;
}

export function defaultEditAttrProps(): EditorDialogEditAttrProps {
  return {
    attr: {},
    isOpen: false,
    onClosed: () => {
      /* */
    },
  };
}

export const EditorDialogEditAttr: React.FC<EditorDialogEditAttrProps> = props => {
  const { t } = useTranslation();

  // prop defaults
  const {
    removeEnabled = false,
    caption = t('edit_attr_dialog_caption'),
    removeCaption = t('edit_attr_dialog_remove'),
  } = props;

  const attrInput = React.createRef<AttrEditor>();

  const onOpened = () => {
    attrInput.current!.focus();
  };

  const onActionClicked = (action: 'edit' | 'remove') => {
    return () => {
      // check for attributes
      const attr = attrInput.current!.value;
      const haveAttr = pandocAttrAvailable(attr);

      // special logic for when we don't have attributes
      if (!haveAttr) {
        // means remove if it's available/enabled
        if (removeEnabled) {
          props.onClosed({ action: 'remove', attr });

          // otherwise means do nothing
        } else {
          onCancel();
        }
      } else {
        props.onClosed({ action, attr });
      }
    };
  };

  const onOK = () => {
    onActionClicked('edit')();
  };

  const onCancel = () => {
    props.onClosed(null);
  };

  const removeButton =
    removeEnabled && pandocAttrAvailable(props.attr) ? (
      <Button onClick={onActionClicked('remove')}>{removeCaption}</Button>
    ) : (
      undefined
    );

  return (
    <Dialog
      isOpen={props.isOpen}
      title={caption}
      onOpened={onOpened}
      onOK={onOK}
      onCancel={onCancel}
      leftButtons={removeButton}
    >
      <AttrEditor defaultValue={props.attr} ref={attrInput} />
    </Dialog>
  );
};

function pandocAttrAvailable(attrs: AttrProps, keyvalue = true) {
  return !!attrs.id || 
         (attrs.classes && attrs.classes.length > 0) || 
         (keyvalue && attrs.keyvalue && attrs.keyvalue.length > 0);
}