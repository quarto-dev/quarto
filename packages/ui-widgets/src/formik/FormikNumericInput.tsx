/*
 * FormtNumericInput.tsx
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

import React, { useRef, useEffect } from 'react';

import { useField } from 'formik';

import { Intent, NumericInput, NumericInputProps } from "@blueprintjs/core";

import FormikFormGroup, { FormikFormGroupProps } from './FormikFormGroup';

const FormikNumericInput: React.FC<FormikFormGroupProps & NumericInputProps> = (props) => {
  const { label, labelInfo, helperText, validated, ...inputProps } = props;
  const [ field, meta, helpers ] = useField(props.name);
  const { name, value } = field;
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
      validated={validated}
    >
      {({ onFocus, onBlur }) => {
        return (
          <NumericInput
            inputRef={autoFocusRef}
            defaultValue={value}
            onValueChange={(_value: number, strValue: string) => {
              helpers.setValue(Number.parseFloat(strValue) || 0);
            }}
            {...inputProps}
            intent={meta.touched && meta.error ? Intent.DANGER : Intent.NONE }
            selectAllOnFocus={true}
            selectAllOnIncrement={true}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        );
      }}
    </FormikFormGroup>
  );
};

export default FormikNumericInput;
