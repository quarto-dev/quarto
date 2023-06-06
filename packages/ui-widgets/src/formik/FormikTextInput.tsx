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

import { Input, InputProps, makeStyles } from "@fluentui/react-components"

import FormikFormGroup, { FormikFormGroupProps } from './FormikFormGroup';

export interface FormikTextInputProps extends FormikFormGroupProps {
  button?: JSX.Element;
}

const FormikTextInput: React.FC<FormikTextInputProps & InputProps> = (props) => {
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

  const styles = useStyles();

  return (
    <FormikFormGroup 
      name={name}
      label={label}
      labelInfo={labelInfo}
      helperText={helperText}
    >
      {({ onFocus, onBlur }) => {
        return (
          <div className={styles.root}>
            <Input
              input={{ ref: autoFocusRef, autoComplete: 'off', autoCorrect: 'off', spellCheck: false }}
              type="text"
              autoComplete='off'
              autoCorrect='off'
              spellCheck='false'
              {...field}
              {...inputProps}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            {props.button || null}
          </div>
        );
      }}
    </FormikFormGroup>
  );
};


const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    columnGap: '8px',
    "& .fui-Input": {
      flexGrow: 1
    }
  },
})

export default FormikTextInput;