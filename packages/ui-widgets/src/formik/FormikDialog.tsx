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

import { Classes, Button, Intent, Dialog } from '@blueprintjs/core';

import { Form, Formik, FormikConfig, FormikProps, FormikValues } from 'formik';

import { modalDialogProps } from '../dialog-props';

import FormikFocusError from './FormikFocusError';

import styles from './Formik.module.scss';
import { FluentProvider, Theme, webLightTheme } from '@fluentui/react-components';

export interface FormikDialogProps<Values extends FormikValues = FormikValues> extends FormikConfig<Values> {
  title?: string;
  isOpen: boolean;
  className?: string;
  theme?: Theme;
  children?: ((props: FormikProps<Values>) => React.ReactNode) | React.ReactNode;
  okCaption?: string;
  noCancelButton?: boolean;
  cancelCaption?: string;
  focusOKButton?: boolean;
  leftButtons?: JSX.Element;
  onOpening?: () => void;
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

        return <Dialog
          title={props.title}
          isOpen={props.isOpen}
          onOpening={props.onOpening}
          onOpened={props.onOpened}
          onClose={() => formikProps.resetForm()}
          {...modalDialogProps([styles.dialog].concat(props.className || []), {}, true)}
        >
         
          <Form onSubmit={onSubmit} ref={formRef} className="formik-Form">
            <FluentProvider theme={props.theme || webLightTheme}>
              <FormikFocusError formRef={formRef}/>
              <div className={[Classes.DIALOG_BODY, styles.dialogBody].join(' ')}>
                {typeof(props.children) === "function" ? props.children(formikProps) : props.children}
              </div>
              <div className={[Classes.DIALOG_FOOTER, styles.dialogFooter].join(' ')}>
                <div className={[Classes.DIALOG_FOOTER_ACTIONS, styles.dialogFooterActions].join(' ')}>
                  <div className={styles.dialogFooterActionsLeft}>{props.leftButtons}</div>
                  <div className={styles.dialogFooterActionsRight}>
                    {!props.noCancelButton 
                        ? <Button className={styles.dialogActionButton} type='reset'>{props.cancelCaption || 'Cancel'}</Button>
                        : null
                    }
                    <Button autoFocus={props.focusOKButton} className={styles.dialogActionButton} intent={Intent.PRIMARY} type='submit'>{props.okCaption || 'OK'}</Button>
                  </div>
                </div>
              </div>
            </FluentProvider>
          </Form>
         
       </Dialog>
      }}
     
    </Formik>
  );


};

export default FormikDialog;