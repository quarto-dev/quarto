/*
 * FormikSwitch.tsx
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

import { Switch, SwitchProps } from "@blueprintjs/core";
import { useField } from "formik";

export interface FormikSwitchProps {
  name: string;
  label: string;
}

const FormikSwitch: React.FC<FormikSwitchProps & SwitchProps> = (props) => {
  const [ field ] = useField(props.name);
  return (
    <Switch {...props} {...field} checked={field.value} />
  );
};

export default FormikSwitch;
