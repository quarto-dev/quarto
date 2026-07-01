/*
 * dialog-buttons.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { WidgetProps } from './react';

import { TextButton } from './button';
import React, { useState } from 'react';

import './dialog-buttons.css';

export interface DialogButtonsProps extends WidgetProps {
  okLabel: string;
  cancelLabel: string;
  onOk: () => void;
  onCancel: () => void;
}

export const DialogButtons: React.FC<DialogButtonsProps> = props => {
  const [isRStudio] = useState(Object.getOwnPropertyNames(window).includes("rstudio"));
  const buttonProps = (primary?: boolean) => {
    const bprops = {
      classes: isRStudio
        ? ['pm-text-button', 'pm-input-button', 'pm-default-theme', 'pm-dialog-buttons-button', 'pm-rstudio-button']
        : ['fluentui-button'],
      style: (isRStudio ? {} : {minWidth: '90px'}) as React.CSSProperties
    }
    if (primary) {
      if (isRStudio) {
        bprops.style.fontWeight = 600;
      } else {
        bprops.classes.push("fluentui-intent-primary");
        bprops.style.marginLeft = '8px';
      }
    }
    return bprops;
  };

  const okButton = 
    <TextButton
      title={props.okLabel}
      onClick={props.onOk}
      {...buttonProps(true)}
    />;

  const cancelButton = 
    <TextButton
      title={props.cancelLabel}
      onClick={props.onCancel}
      {...buttonProps()}
    />
    
  return (
    <div className="pm-dialog-buttons-panel" style={props.style}>
      {isRStudio 
        ? <>{okButton}{cancelButton}</>
        : <>{cancelButton}{okButton}</>
      }
    </div>
  );
};
