/*
 * FormikTextInput.tsx
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

import React, { useRef, useState } from 'react';

import { AnchorButton, FormGroup, InputGroup, InputGroupProps2, Intent, PopoverPosition } from "@blueprintjs/core";
import { useField } from 'formik';
import { Tooltip2 } from '@blueprintjs/popover2';

import styles from './Formik.module.scss';
import { IconNames } from '@blueprintjs/icons';

export interface FormikTextInputProps {
  name: string;
  label: string;
  labelInfo?: string;
  helperText?: string;
  validated?: boolean;
}

const FormikTextInput: React.FC<FormikTextInputProps & InputGroupProps2> = (props) => {
    const [ field, meta ] = useField(props.name);
    const { label, labelInfo, validated, ...inputProps } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputFocused, setInputFocused] = useState(false);
    return (
      <>
      <FormGroup
        label={label}
        className={validated ? styles.validatedFormGroup : undefined}
        intent={meta.touched && meta.error ? Intent.DANGER : Intent.NONE }
        labelInfo={labelInfo}
        helperText={props.helperText}
      >
        <InputGroup
          inputRef={inputRef}
          autoComplete={"off"}
          fill={true}
          intent={meta.touched && meta.error ? Intent.DANGER : Intent.NONE }
          rightElement={validated && meta.touched && !!meta.error 
              ? <AnchorButton tabIndex={-1} minimal={true} icon={IconNames.Issue} title={meta.error} /> 
              : undefined}
          type="text"
          {...field}
          {...inputProps}
          onFocus={() => setInputFocused(true)}
          onBlur={(ev) => {setInputFocused(false); field.onBlur(ev)}}
        /> 
      </FormGroup>
      { validated ? 
        <Tooltip2
          className={styles.tooltip}
          content={meta.error}
          isOpen={validated && meta.touched && !!meta.error && inputFocused}
          placement={PopoverPosition.BOTTOM}
          popoverClassName={props.helperText ? styles.validationPopupWithHelper : styles.validationPopup}
          enforceFocus={false}
          canEscapeKeyClose={false}
        >
          <div className={styles.tooltip} tabIndex={-1} />
        </Tooltip2> 
        : null}
      </>
    );
};

export default FormikTextInput;