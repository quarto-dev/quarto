/*
 * EditorDialogEditImage.tsx
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

import { ImageEditResult, ImageProps, ImageDimensions } from 'editor';

import { Dialog } from '../../../widgets/dialog/Dialog';
import { DialogTextInput } from '../../../widgets/dialog/DialogInputs';
import { focusInput } from '../../../widgets/utils';

import { AttrEditor } from './AttrEditor';

export interface EditorDialogEditImageProps {
  image: ImageProps;
  dims: ImageDimensions | null;
  editAttributes: boolean;
  isOpen: boolean;
  onClosed: (result: ImageEditResult | null) => void;
}

export function defaultEditImageProps(): EditorDialogEditImageProps {
  return {
    image: { src: '' },
    dims: null,
    editAttributes: true,
    isOpen: false,
    onClosed: () => {
      /* */
    },
  };
}

export const EditorDialogEditImage: React.FC<EditorDialogEditImageProps> = props => {
  const { t } = useTranslation();

  const srcInput = React.createRef<HTMLInputElement>();
  const titleInput = React.createRef<HTMLInputElement>();
  const altInput = React.createRef<HTMLInputElement>();
  const attrInput = React.createRef<AttrEditor>();

  const onOpened = () => {
    focusInput(srcInput.current);
  };

  const onOK = () => {
    if (srcInput.current!.value) {
      props.onClosed({
        src: srcInput.current!.value,
        title: titleInput.current!.value,
        alt: altInput.current!.value,
        width: props.image.width,
        height: props.image.height,
        units: props.image.units,
        lockRatio: props.image.lockRatio,
        ...(props.editAttributes ? attrInput.current!.value : null),
      });
    } else {
      onCancel();
    }
  };

  const onCancel = () => {
    props.onClosed(null);
  };

  return (
    <Dialog
      isOpen={props.isOpen}
      title={t('edit_image_dialog_caption') as string}
      onOpened={onOpened}
      onOK={onOK}
      onCancel={onCancel}
    >
      <DialogTextInput label={t('edit_image_dialog_src')} defaultValue={props.image.src || ''} ref={srcInput} />
      <DialogTextInput label={t('edit_image_dialog_title')} defaultValue={props.image.title} ref={titleInput} />
      <DialogTextInput label={t('edit_image_dialog_alt')} defaultValue={props.image.alt} ref={altInput} />
      {props.editAttributes ? <AttrEditor defaultValue={props.image} ref={attrInput} /> : null}
    </Dialog>
  );
};
