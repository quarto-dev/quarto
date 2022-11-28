/*
 * CommandManager.tsx
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

import React, { PropsWithChildren } from 'react';


import { CommandId, Command } from './commands';
import { EditorMenus } from 'editor';
import { Props } from '@blueprintjs/core';

export type Commands = { [id in CommandId]?: Command };

export interface CommandManagerContextState {
  commands: Commands;
  menus: EditorMenus;
}

export type CommandManagerAction = 
   | { type: "ADD_COMMANDS", payload: Command[] }
   | { type: "SET_MENUS", payload: EditorMenus }
   | { type: "EXEC_COMMAND", payload: CommandId };

export type CommandManagerContextInstance = [CommandManagerContextState, React.Dispatch<CommandManagerAction>];

const initialCommandManagerState: CommandManagerContextState = 
  { commands: {}, menus: { format: [], insert: [], table: []} };
const noOpDispatch: React.Dispatch<CommandManagerAction> = () => null;

export const CommandManagerContext = React.createContext<CommandManagerContextInstance>([initialCommandManagerState, noOpDispatch]);

const commandManagerReducer = (state: CommandManagerContextState, action: CommandManagerAction) : CommandManagerContextState => {
  switch(action.type) {
    case "ADD_COMMANDS": {
      const newCommandsById: Commands = {};
      action.payload.forEach(command => {
        newCommandsById[command.id] = command;
      });
      const commands = {
        ...state.commands,
        ...newCommandsById,
      };

      return { ...state, commands };
    }
    case "SET_MENUS": {
      return { ...state, menus: action.payload }
    }
    case "EXEC_COMMAND": {
      const command = state.commands[action.payload];
      if (command) {
        command.execute();
      }
      return state;
    }
    default: {
      return state;
    }
  }
}


export const CommandManagerProvider: React.FC<PropsWithChildren<Props>> = props => {
  const [state, dispatch] = React.useReducer(commandManagerReducer, initialCommandManagerState);
  return <CommandManagerContext.Provider value={[state, dispatch]}>{props.children}</CommandManagerContext.Provider>;
};

