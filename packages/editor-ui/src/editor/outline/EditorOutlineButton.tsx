/*
 * EditorOutlineButton.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React, { useContext } from 'react';

import {
  TextAlignJustify20Filled,
  TextAlignJustify20Regular,
  bundleIcon
} from "@fluentui/react-icons"

const TextAlignJustifyIcon = bundleIcon(TextAlignJustify20Filled, TextAlignJustify20Regular);

import { Button } from '@fluentui/react-components';


import { CommandManagerContext, commandTooltipText, EditorUICommandId } from 'editor-ui';

import styles from './EditorOutlineSidebar.module.scss';


export interface EditorOutlineButtonProps {
  visible: boolean;
  onClick: () => void;
}

export const EditorOutlineButton: React.FC<EditorOutlineButtonProps> = props => {
  const [cmState] = useContext(CommandManagerContext);
  const command = cmState.commands[EditorUICommandId.ShowOutline];
  const title = command ? commandTooltipText(command) : '';

  if (props.visible) {
    return (
      <div className={styles.showOutlineButtonGutter}>
        <Button 
          title={title} 
          className={styles.showOutlineButton} 
          icon={<TextAlignJustifyIcon />} 
          appearance='transparent'  
          onClick={props.onClick} 
        />
      </div>
    );
  } else {
    return null;
  }
};
