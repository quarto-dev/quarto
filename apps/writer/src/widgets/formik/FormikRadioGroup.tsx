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


import { RadioGroup, RadioGroupProps } from "@blueprintjs/core";
import { useField } from "formik";
import React from "react";

export interface FormikRadioGroupProps {
  name: string;
  label?: string;
}

const FormikRadioGroup: React.FC<FormikRadioGroupProps & Omit<RadioGroupProps, "onChange">> = (props) => {
  const [ field ] = useField(props.name);
  return (
    <RadioGroup {...props} {...field} selectedValue={field.value} />
  );
};

export default FormikRadioGroup;


