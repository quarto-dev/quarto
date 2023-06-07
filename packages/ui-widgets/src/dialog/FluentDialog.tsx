/*
 * FluentDialog.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */



import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, FluentProvider, Theme, webLightTheme } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import React from "react";


export interface FluentDialogProps {
  title?: string;
  isOpen: boolean;
  theme?: Theme;
  children: React.ReactNode;
  onOK: () => void;
  onOpened?: () => void;
  onCancel?: () => void;
  okCaption?: string;
  noCancelButton?: boolean;
  cancelCaption?: string;
  focusOKButton?: boolean;
  leftButtons?: JSX.Element;
}

export const FluentDialog: React.FC<FluentDialogProps> = props => {

  return (
    <FluentProvider theme={props.theme || webLightTheme}>
      <Dialog
        modalType='modal'
        open={props.isOpen}
        onOpenChange={(_event, data) => {
          if (data.open) {
            props.onOpened?.()
          } else {
            props.onCancel?.();
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={props.noCancelButton ?
                <DialogTrigger action="close">
                  <Button
                    appearance="subtle"
                    aria-label="close"
                    icon={<Dismiss24Regular />}
                  />
                </DialogTrigger>
                : undefined}
            >
              {props.title}
            </DialogTitle>
            <DialogContent>
              {props.children}
            </DialogContent>
            <DialogActions position="start">
              {props.leftButtons}
            </DialogActions>
            <DialogActions position="end">
              {!props.noCancelButton
                ? <DialogTrigger disableButtonEnhancement>
                    <Button appearance='secondary'>{props.cancelCaption || 'Cancel'}</Button>
                  </DialogTrigger>
                : null
              }
              <Button 
                autoFocus={props.focusOKButton} 
                onClick={() => props.onOK()} 
                appearance='primary'>
                  {props.okCaption || 'OK'}
              </Button>
            </DialogActions>
          </DialogBody>

        </DialogSurface>
      </Dialog>
    </FluentProvider>

  );
}

