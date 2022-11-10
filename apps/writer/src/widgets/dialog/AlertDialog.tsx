/*
 * AlertDialog.tsx
 *
 * Copyright (C) 2019-20 by RStudio, PBC
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

import React, { PropsWithChildren } from 'react';

import { Alert, IconName, Props } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import { kAlertTypeError, kAlertTypeInfo, kAlertTypeWarning } from 'editor';

import styles from './AlertDialog.module.scss';

export interface AlertDialogProps extends Props {
  title?: string;
  message?: string;
  type: number;
  isOpen: boolean;
  onClosed: () => void;
}

export const AlertDialog: React.FC<PropsWithChildren<AlertDialogProps>> = props => {
  let icon: IconName;
  switch (props.type) {
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

  const children = props.children ? props.children : <p>{props.message}</p>;

  return (
    <Alert
      isOpen={props.isOpen}
      onClose={props.onClosed}
      onCancel={props.onClosed}
      canOutsideClickCancel={true}
      canEscapeKeyCancel={true}
      icon={icon}
      className={styles.alertDialog}
    >
      <p>
        <strong>{props.title}</strong>
      </p>
      {children}
    </Alert>
  );
};
