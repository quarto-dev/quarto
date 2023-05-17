/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * html-dialog.tsx
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

import React, { useRef, useState } from "react";

import { createRoot } from "react-dom/client";

import { 
  Dialog, 
  DialogBody, 
  DialogContent, 
  DialogSurface, 
  DialogTitle, 
  FluentProvider,
  makeStyles,
  webLightTheme 
} from "@fluentui/react-components";

import { EditorHTMLDialogCreateFn, EditorHTMLDialogValidateFn } from "editor-types";
import { fluentTheme, isSolarizedThemeActive } from "../theme";

export async function htmlDialog(
  title: string, 
  okText: string | null, 
  create: EditorHTMLDialogCreateFn, 
  focus: VoidFunction, 
  validate: EditorHTMLDialogValidateFn
) : Promise<boolean>  {

  return new Promise(resolve => {
    
    // create reacte root
    const parent = globalThis.document.createElement("div");
    const root = createRoot(parent);
    
    // forward args and onClose handler
    const props = {
      title,
      okText,
      create,
      focus,
      validate,
      onClosed: (ok: boolean) => {
        root.unmount();
        parent.remove();
        resolve(ok);
      }  
    };

    // render dialog
    root.render(<HtmlDialog {...props} />);
  });
      
}

interface HtmlDialogProps {
  title: string;
  okText: string | null;
  create: EditorHTMLDialogCreateFn;
  focus: VoidFunction;
  validate: EditorHTMLDialogValidateFn;
  onClosed: (ok: boolean) => void;
}


const HtmlDialog: React.FC<HtmlDialogProps> = (props) => {

  const [isOpen, setIsOpen] = useState(true);

  const onCancel = () => {
    setIsOpen(false);
    props.onClosed(false);
  };

  const onOK = () => {
    setIsOpen(false);
    props.onClosed(true);
  };

  // progress toast
  const [progress, setProgress] = useState<string | null>(null);

  // create dialog and note size
  const dialogWidgetRef = useRef<HTMLElement>(props.create(
    window.innerWidth, 
    window.innerHeight, 
    onOK, 
    onCancel, 
    setProgress, 
    () => {setProgress(null)},
    !isSolarizedThemeActive() )
  );
  const kTitleHeight = 28
  const kGridGap = 8;
  const padding = 24;
  const width = `calc(${dialogWidgetRef.current.style.width} + ${2 * padding}px`;
  const height = `calc(${dialogWidgetRef.current.style.height} + ${2 * padding}px + ${kTitleHeight}px  + ${2 * kGridGap}px`;
  const themed = !isSolarizedThemeActive();

  const dialogBodyRef = (el: HTMLDivElement | null) => {
    if (el) {
      el.appendChild(dialogWidgetRef.current);
    }
  };

  const classes = useStyles();

  return (
    <FluentProvider theme={themed ? fluentTheme() : webLightTheme}>
      <Dialog
        modalType="modal"
        open={isOpen}
        onOpenChange={(_event,data) => {
          if (!data.open) {
            onCancel()
          }
        }} 
      > 
        <DialogSurface className={classes.dialogSurface} style={{width, height}}>
          <DialogBody>
            <DialogTitle>
              {props.title}
            </DialogTitle>
            <DialogContent className={classes.dialogContent}>
              <Progress message={progress} />
              <div ref={dialogBodyRef} />  
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </FluentProvider>
  );
};

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: 'none'
  },
  dialogContent: {
    overflowY: 'visible'
  }
})

import { Intent, Spinner, SpinnerSize, Toast, Toaster, Text, Position } from "@blueprintjs/core";


interface ProgressProps {
  message: string | null;
}

const Progress : React.FC<ProgressProps> = props => {
  if (props.message) {
    return (
      <Toaster position={Position.TOP} usePortal={false} autoFocus={true}>
        <Toast 
          message={
            <Text>
              <Spinner 
                size={SpinnerSize.SMALL} 
                intent={Intent.PRIMARY} 
                style={{
                  display: 'inline-block',
                  marginRight: 10
                }} 
              />
              {props.message}
            </Text>
          } 
          isCloseButtonShown={false} 
          timeout={0}
        />
      </Toaster>
    );
  } else {
    return null;
  }
};
