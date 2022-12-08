/*
 * FormikTextArea.tsx
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

import { useField } from 'formik';

import { TextArea, TextAreaProps, Intent } from "@blueprintjs/core";

import FormikFormGroup, { FormikFormGroupProps } from './FormikFormGroup';

const FormikTextArea: React.FC<FormikFormGroupProps & TextAreaProps> = (props) => {
  const { name, label, labelInfo, helperText, ...textAreaProps } = props;
  const [ field, meta ] = useField(name);
    return (
      <FormikFormGroup 
        name={name}
        label={label}
        labelInfo={labelInfo}
        helperText={helperText}
      >
        {({ onFocus, onBlur }) => {
          return (
            <TextArea
              autoComplete={"off"}
              intent={meta.touched && meta.error ? Intent.DANGER : Intent.NONE }
              {...field}
              {...textAreaProps}
              onFocus={onFocus}
              onBlur={onBlur}
            /> 
          );
        }}
      </FormikFormGroup>
    );
};

export default FormikTextArea;