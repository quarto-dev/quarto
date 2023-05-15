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

import React, { useEffect, useRef } from 'react';

import { useField } from 'formik';

import { Input, InputProps } from "@fluentui/react-components"

import FormikFormGroup, { FormikFormGroupProps } from './FormikFormGroup';

const FormikTextInput: React.FC<FormikFormGroupProps & InputProps> = (props) => {
  const { name, label, labelInfo, helperText, ...inputProps } = props;
  const [ field ] = useField(name);

  const autoFocusRef = useRef<HTMLInputElement>(null);

  if (props.autoFocus) {
    useEffect(() => {
      setTimeout(() => {
        autoFocusRef.current?.focus();
      }, 0);
    }, []);
  }

  return (
    <FormikFormGroup 
      name={name}
      label={label}
      labelInfo={labelInfo}
      helperText={helperText}
    >
      {({ onFocus, onBlur }) => {
        return (
          <Input
            input={{ ref: autoFocusRef }}
            autoComplete='off'
            type="text"
            {...field}
            {...inputProps}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        );
      }}
    </FormikFormGroup>
  );
};

export default FormikTextInput;