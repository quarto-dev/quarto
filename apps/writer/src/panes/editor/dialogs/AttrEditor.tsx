/*
 * AtrrEditor.tsx
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

import React, { createRef, useEffect, useRef } from 'react';

import { useTranslation } from 'react-i18next';

import { TextArea, FormGroup } from '@blueprintjs/core';

import { AttrProps, UITools } from 'editor';

import { DialogTextInput } from '../../../widgets/dialog/DialogInputs';
import { focusInput } from '../../../widgets/utils';

export interface AttrEditorProps {
  value: AttrProps;
  onChange: (attr: AttrProps) => void;
  focus?: boolean;
}

export const AttrEditor: React.FC<AttrEditorProps> = (props) => {

  const { t } = useTranslation();
  const uiTools = useRef(new UITools());

  const idInput = createRef<HTMLInputElement>();
  const classesInput = createRef<HTMLInputElement>();
  const keyvalueInput = useRef<HTMLTextAreaElement>();
  const onKeyvalueInput = (el: HTMLTextAreaElement) => {
    keyvalueInput.current = el;
  }

  const value = uiTools.current.attr.propsToInput(props.value);

  const onChange = () => {
    const attr = uiTools.current.attr.inputToProps({
      id: idInput.current!.value,
      classes: classesInput.current!.value,
      keyvalue: keyvalueInput!.current!.value,
    });
    props.onChange(attr);
  };

  useEffect(() => {
    if (props.focus) {
      focusInput(idInput.current);
    }
  }, []);

  return (
    <>
      <DialogTextInput label={t('attr_editor_id')} defaultValue={props.value.id} onChange={onChange} ref={idInput} />
      <DialogTextInput label={t('attr_editor_classes')} defaultValue={value.classes} onChange={onChange} ref={classesInput} />
      <FormGroup label={t('attr_editor_keyvalue')}>
        <TextArea defaultValue={value.keyvalue} inputRef={onKeyvalueInput} onChange={onChange} fill={true} />
      </FormGroup>
    </>
  );
}
