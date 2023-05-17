/*
 * FormikHTMLSelect.tsx
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

import React, { useEffect, useRef } from "react";

import { Select, SelectProps } from "@fluentui/react-components"

import { useField } from "formik";

import FormikFormGroup, { FormikFormGroupProps } from "./FormikFormGroup";

const FormikHTMLSelect: React.FC<FormikFormGroupProps & SelectProps & {
  options: string[] | Array<{ label?: string, value: string | number }>
}> = (props) => {
  const [ field ] = useField(props.name);
  const { label, labelInfo, helperText, ...selectProps } = props;

  const autoFocusRef = useRef<HTMLSelectElement>(null);

  if (props.autoFocus) {
    useEffect(() => {
      setTimeout(() => {
        autoFocusRef.current?.focus();
      }, 0);
    }, []);
  }
  
  return (
    <FormikFormGroup
      name={field.name}
      label={label}
      labelInfo={labelInfo}
      helperText={helperText}
    >
      {({ onFocus, onBlur }) => {
        return (
          <Select 
            select={{ ref: autoFocusRef, multiple: false }} 
            {...selectProps} 
            {...field} 
            onFocus={onFocus}
            onBlur={onBlur}
          >
            {props.options.map(option => {
              if (typeof(option) === "string") {
                option = {
                  value: option
                }
              }
              return (
                <option value={option.value}>
                  {option.label || option.value}
                </option>);
            })}
          </Select>
        );
      }}
    </FormikFormGroup>
  );
};

export default FormikHTMLSelect;


