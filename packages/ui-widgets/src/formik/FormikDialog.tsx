/*
 * FormikDialog.tsx
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

import React, { useState, useRef } from 'react';

import { 
  FluentProvider, 
  Theme, 
  webLightTheme,
  Button, 
  Dialog, 
  DialogActions, 
  DialogBody, 
  DialogContent, 
  DialogSurface, 
  DialogTitle, 
  DialogTrigger
} from '@fluentui/react-components';

import {
  Dismiss24Regular
} from '@fluentui/react-icons';

import { Form, Formik, FormikConfig, FormikProps, FormikValues } from 'formik';

import FormikFocusError from './FormikFocusError';


export interface FormikDialogProps<Values extends FormikValues = FormikValues> extends FormikConfig<Values> {
  title?: string;
  isOpen: boolean;
  theme?: Theme;
  children?: ((props: FormikProps<Values>) => React.ReactNode) | React.ReactNode;
  okCaption?: string;
  noCancelButton?: boolean;
  cancelCaption?: string;
  focusOKButton?: boolean;
  leftButtons?: JSX.Element;
  onOpened?: () => void;
}

function FormikDialog<Values extends FormikValues = FormikValues>(props: FormikDialogProps<Values>) {

  const [validateOnChange, setValidateOnChange] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  
  return (
    <Formik {...props} validateOnChange={validateOnChange} validateOnBlur={false}>
      {(formikProps: FormikProps<Values>) => {

        const onSubmit = (ev: React.FormEvent) =>{
          ev.preventDefault()
          setValidateOnChange(true);
          return formikProps.handleSubmit();
        }

        return (
          <FluentProvider theme={props.theme || webLightTheme}>
            <Dialog
              modalType='modal'
              open={props.isOpen}
              onOpenChange={(_event,data) => {
                if (data.open) {
                  props.onOpened?.()
                } else {
                  formikProps.resetForm()
                }
              }} 
            >
              <DialogSurface>
                <FormikFocusError formRef={formRef}/>
                <Form onSubmit={onSubmit} ref={formRef} className="formik-Form">
                  <DialogBody>
                    <DialogTitle
                      action={
                        <DialogTrigger action="close">
                          <Button
                            appearance="subtle"
                            aria-label="close"
                            icon={<Dismiss24Regular />}
                          />
                        </DialogTrigger>
                      }>
                      {props.title}
                    </DialogTitle>
                    <DialogContent>
                      {typeof(props.children) === "function" ? props.children(formikProps) : props.children}
                    </DialogContent>
                    <DialogActions position="start">
                      {props.leftButtons}
                    </DialogActions>
                    <DialogActions position="end">
                      {!props.noCancelButton 
                        ? <Button appearance='secondary' type='reset'>{props.cancelCaption || 'Cancel'}</Button>
                        : null
                      }
                      <Button autoFocus={props.focusOKButton} appearance='primary' type='submit'>{props.okCaption || 'OK'}</Button>
                    </DialogActions>
                  </DialogBody>
                </Form>
              </DialogSurface>
            </Dialog>
          </FluentProvider>
        );
      }} 
    </Formik>
  );
};

export default FormikDialog;