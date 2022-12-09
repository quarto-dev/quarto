/*
 * AlertDialog.tsx
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

import { Alert, IconName, Intent } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import { kAlertTypeError, kAlertTypeInfo, kAlertTypeWarning } from 'editor-types';

import { showValueEditorDialog } from 'ui-widgets';

import styles from './styles.module.scss';

export async function alert(message: string, title: string, type: number): Promise<boolean> {
  const values: boolean | null = false;
  const result = await showValueEditorDialog(AlertDialog, values, { title, message, type });
  return !!result;
}


interface AlertDialogOptions {
  title?: string;
  message?: string;
  type: number;
}

const AlertDialog: React.FC<{ 
  values: boolean,
  options: AlertDialogOptions,
  onClosed: (values?: boolean) => void }

> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: boolean) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  let icon: IconName;
  switch (props.options.type) {
    case kAlertTypeError:
      icon = IconNames.ERROR;
      break;
    case kAlertTypeWarning:
      icon = IconNames.WARNING_SIGN;
      break;
    case kAlertTypeInfo:
    default:
      icon = IconNames.INFO_SIGN;
      break;
  }


  return (
    <Alert
      isOpen={isOpen}
      onClose={() => close(true)}
      onCancel={() => close()}
      canOutsideClickCancel={true}
      canEscapeKeyCancel={true}
      intent={Intent.PRIMARY}
      icon={icon}
      className={styles.alertDialog}
    >
      <p>
        <strong>{props.options.title}</strong>
      </p>
      <p>{props.options.message}</p>
    </Alert>
  );
};
