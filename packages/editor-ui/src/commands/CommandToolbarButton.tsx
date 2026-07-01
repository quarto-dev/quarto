/*
 * CommandToolbarButton.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React, { useContext } from 'react';


import { ToolbarButton } from '../menu/Toolbar';
import { commandTooltipText } from './commands';
import { CommandManagerContext } from 'editor-ui';

export interface CommandToolbarButtonProps  {
  command: string;
}

export const CommandToolbarButton: React.FC<CommandToolbarButtonProps> = (props) => {
  // force re-render when the selection changes
  const [cmState] = useContext(CommandManagerContext);

  // get command
  const command = cmState.commands[props.command];
  if (command) {
    return (
      <ToolbarButton
        icon={command.icon}
        title={commandTooltipText(command)}
        enabled={command.isEnabled()}
        active={command.isActive()}
        onClick={command.execute}
      />
    );
  } else {
    return null;
  }
};
