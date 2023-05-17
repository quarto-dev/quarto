/*
 * FormikRadioGroup.tsx
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

import React from "react";

import { Radio, RadioGroup, RadioGroupProps } from "@fluentui/react-components";

import { useField } from "formik";

import FormikFormGroup, { FormikFormGroupProps } from "./FormikFormGroup";

const FormikRadioGroup: React.FC<FormikFormGroupProps & Omit<RadioGroupProps, "onChange"> & {
  options: Array<{value: string, label: string}>;
}> = (props) => {
  const [ field ] = useField(props.name);
  const { name, label, labelInfo, helperText, ...radioProps } = props;
  return (
    <FormikFormGroup
      name={name}
      label={label}
      labelInfo={labelInfo}
      helperText={helperText}
    >
        {({ onFocus, onBlur }) => {
        return (
          <RadioGroup {...field} {...radioProps} onFocus={onFocus} onBlur={onBlur}>
            {props.options.map(option => {
              return <Radio {...option} />;
            })}
          </RadioGroup>
        )
        }}
    </FormikFormGroup>
  );
};

export default FormikRadioGroup;


