/*
 * alert.tsx
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

import React, { useState } from 'react';

import { Classes, ControlGroup, Icon, IconName, IconSize, Intent, Label } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import { FormikValues } from 'formik';

import { kAlertTypeError, kAlertTypeInfo, kAlertTypeWarning } from 'editor-types';

import { FormikDialog, showValueEditorDialog } from 'ui-widgets';

import styles from './styles.module.scss';

export function alert(message: string, title: string, type: number): Promise<boolean> {
  return alertDialog(message, title, type, true);
}

export async function yesNoMessage(message: string, title: string, type: number, yesLabel: string, noLabel: string): Promise<boolean> {
  return alertDialog(message, title, type, false, yesLabel, noLabel);
}

async function alertDialog(message: string, title: string, type: number, noCancelButton?: boolean, okLabel?: string, cancelLabel?: string) {
  const result = await showValueEditorDialog(AlertDialog, {}, { title, message, type, noCancelButton, okLabel, cancelLabel });
  return !!result;
}

interface AlertDialogOptions {
  type: number;
  title?: string;
  message?: string;
  noCancelButton?: boolean;
  okLabel?: string;
  cancelLabel?: string;
}

const AlertDialog: React.FC<{ 
  values: FormikValues,
  options: AlertDialogOptions,
  onClosed: (values?: FormikValues) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: FormikValues) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  let icon: IconName;
  let intent: Intent;
  switch (props.options.type) {
    case kAlertTypeError:
      icon = IconNames.ERROR;
      intent = Intent.DANGER;
      break;
    case kAlertTypeWarning:
      icon = IconNames.WARNING_SIGN;
      intent = Intent.WARNING;
      break;
    case kAlertTypeInfo:
    default:
      icon = IconNames.INFO_SIGN;
      intent = Intent.PRIMARY;
      break;
  }

   return (
    <FormikDialog
      title={props.options.title} 
      okCaption={props.options.okLabel}
      noCancelButton={props.options.noCancelButton}
      cancelCaption={props.options.cancelLabel}
      focusOKButton={true}
      isOpen={isOpen} 
      initialValues={props.values} 
      onSubmit={(values) => close(values) }
      onReset={() => close() }
      className={styles.alertDialog}
    >
      <ControlGroup vertical={false} fill={true}>
        <Icon icon={icon} size={36} intent={intent} className={Classes.FIXED} />
        <Label>{props.options.message}</Label>
      </ControlGroup>
     
    </FormikDialog>
  );
  
};
