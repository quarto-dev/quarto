/*
 * EditorLoadFailed.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from 'react';

import { Button, tokens } from "@fluentui/react-components"
import { CodeRegular } from "@fluentui/react-icons"

import { EditorUIContext } from 'editor';
import { NonIdealState } from 'ui-widgets';

import { EditorError } from '../store';
import { t } from '../i18n';
export interface EditorLoadFailedProps {
  error: EditorError;
  uiContext: EditorUIContext
}

export const EditorLoadFailed:  React.FC<EditorLoadFailedProps> = (props) => {

  const editAction = props.uiContext.reopenInSourceMode 
    ? <Button 
        icon={<CodeRegular />}
        style={{ 
          color: tokens.colorPaletteBlueBorderActive, 
          borderColor: tokens.colorPaletteBlueBorderActive 
        }}
        appearance="outline"
        onClick={() => props.uiContext.reopenInSourceMode!()}
      >
        {t('return_to_source_mode')} 
      </Button>
    : undefined;

  return (
    <NonIdealState
      icon={props.error.icon}
      title={props.error.title}
      action={editAction}
    >
      <p>
      {props.error.description.map(line => {
        return <><span>{line}</span><br/></>;
      })}
      </p>
    </NonIdealState>
  )

  
};

