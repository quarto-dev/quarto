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

import { Field } from "@fluentui/react-components";

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
  autoFocus?: boolean;
}

export interface FormGroupChildren {
  children: (focusHandlers: FormikFormGroupFocusHandlers) => ReactNode;
} 


const FormikFormGroup: React.FC<FormikFormGroupProps & FormGroupChildren> = props => {
  const [ field, meta ] = useField(props.name);
  // NOTE: we currently don't use the focused state (we used to use it to show/hide a
  // tooltip w/ the validation message however the message is now below the input).
  // leave this logic + the onFocus/onBlur callbacks in case we want any behavior or 
  // appearance to dervie from focus state in the future
  const [ , setInputFocused] = useState(false);
  const onFocus = () => setInputFocused(true);
  const onBlur = (ev: unknown) => { setInputFocused(false); field.onBlur(ev)};

  return (
    <Field
      label={props.label + (props.labelInfo ? ` ${props.labelInfo}` : "")}
      validationState={meta.touched && meta.error ? "error" : "none" }
      validationMessage={meta.error}
      hint={!meta.error ? (props.helperText || <div>&nbsp;</div>) : undefined}
    >
      {props.children({ onFocus, onBlur })}
    </Field>
  );
}

export default FormikFormGroup;
