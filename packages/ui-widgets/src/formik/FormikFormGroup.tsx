/*
 * FormikFormGroup.ts
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

import React, { ReactNode, useState } from "react";

import { FormGroup, Intent, PopoverPosition } from "@blueprintjs/core";
import { Tooltip2 } from "@blueprintjs/popover2";
import { useField } from "formik";


export interface FormikFormGroupFocusHandlers {
  onFocus: React.FocusEventHandler;
  onBlur: React.FocusEventHandler
}

export interface FormikFormGroupProps {
  name: string;
  label: string;
  labelInfo?: string;
  helperText?: string;
  validated?: boolean;
  autoFocus?: boolean;
}

export interface FormGroupChildren {
  children: (focusHandlers: FormikFormGroupFocusHandlers) => ReactNode;
} 

import styles from './Formik.module.scss';

const FormikFormGroup: React.FC<FormikFormGroupProps & FormGroupChildren> = props => {
  const [ field, meta ] = useField(props.name);
  const [inputFocused, setInputFocused] = useState(false);
  const onFocus = () => setInputFocused(true);
  const onBlur = (ev: unknown) => { setInputFocused(false); field.onBlur(ev)};

  return (
    <FormGroup
      label={props.label}
      className={props.validated ? styles.validatedFormGroup : undefined}
      intent={meta.touched && meta.error ? Intent.DANGER : Intent.NONE }
      labelInfo={props.labelInfo}
      helperText={props.helperText}
    >
      {props.children({ onFocus, onBlur })}
      { props.validated ? 
        <Tooltip2
          className={styles.tooltip}
          content={meta.error}
          disabled={!meta.error}
          isOpen={props.validated && meta.touched && !!meta.error && inputFocused}
          placement={PopoverPosition.BOTTOM}
          popoverClassName={styles.validationPopup}
          enforceFocus={false}
          canEscapeKeyClose={false}
        >
          <div className={styles.tooltip} tabIndex={-1} />
      </Tooltip2> 
      : null}
    </FormGroup>
   
  );
}

export default FormikFormGroup;
