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

// TODO: portal to automatically pick up theme
// TODO: get rid of glass behind dialog

import React, { useState } from 'react';

import { 
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  FluentProvider,
  webLightTheme,
  makeStyles,
  tokens
} from "@fluentui/react-components"


import {
  Info24Regular,
  ErrorCircle24Regular,
  Warning24Regular
} from "@fluentui/react-icons"


import { FormikValues } from 'formik';


import { kAlertTypeError, kAlertTypeInfo, kAlertTypeWarning } from 'editor-types';

import { showValueEditorDialog } from 'ui-widgets';

import { t } from './translate';

export function alert(title: string, message: string | JSX.Element, type: number): Promise<boolean> {
  return alertDialog(title, message, type, true);
}

export async function yesNoMessage(title: string, message: string | JSX.Element, type: number, yesLabel: string, noLabel: string): Promise<boolean> {
  return alertDialog(title, message, type, false, yesLabel, noLabel);
}

async function alertDialog(title: string, message: string | JSX.Element, type: number, noCancelButton?: boolean, okLabel?: string, cancelLabel?: string) {
  const result = await showValueEditorDialog(AlertDialog, {}, { title, message, type, noCancelButton, okLabel, cancelLabel });
  return !!result;
}

interface AlertDialogOptions {
  type: number;
  title?: string;
  message?: string | JSX.Element;
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

  const alertIcon = () => {
    const color = props.options.type === kAlertTypeError 
      ? tokens.colorPaletteRedForeground1
      : props.options.type === kAlertTypeWarning 
      ? tokens.colorPaletteDarkOrangeForeground1
      : tokens.colorPaletteBlueForeground2;
    switch (props.options.type) {
      case kAlertTypeError:
        return <ErrorCircle24Regular color={color} />;
      case kAlertTypeWarning:
        return <Warning24Regular color={color} />
      case kAlertTypeInfo:
      default:
        return <Info24Regular color={color} />
    }
  }
  
  const classes = useStyles();

  return (
    <FluentProvider theme={webLightTheme}>
      <Dialog 
        modalType={props.options.noCancelButton ? "modal" : "alert"} 
        open={isOpen} 
        onOpenChange={(_event,data) => {
          if (!data.open) {
            close();
          }
        }} 
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              <div className={classes.title}>
                {alertIcon()}&nbsp;&nbsp;{props.options.title}
              </div></DialogTitle>
            <DialogContent>
              {props.options.message}
            </DialogContent>
            <DialogActions>
              {!props.options.noCancelButton 
                ? <DialogTrigger disableButtonEnhancement>
                    <Button onClick={() => close()} appearance="secondary">{props.options.cancelLabel || t("Cancel")}</Button>
                  </DialogTrigger>
                : null
              }
              <Button onClick={() => close({})} appearance="primary">{props.options.okLabel || t("OK")}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </FluentProvider>
    
  );
  
};


const useStyles = makeStyles({
  title: {
    display: 'inline-flex',
    alignItems: 'center'
  }
})