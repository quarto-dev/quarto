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

import React, { PropsWithChildren, useState } from 'react';

import { Props } from '@blueprintjs/core';

import { CommandId, Command } from './commands';
import { EditorMenus } from 'editor';

export type Commands = { [id in CommandId]?: Command };

export interface CommandManager {
  commands: Commands;
  menus: EditorMenus;
  addCommands: (commands: Command[]) => void;
  setMenus: (menus: EditorMenus) => void;
  execCommand: (id: CommandId) => void;
}

export const CommandManagerContext = React.createContext<CommandManager>({
  commands: {},
  menus: { format: [], insert: [], table: [] },
  addCommands: () => {
    /* */
  },
  setMenus: () => {
    /* */
  },
  execCommand: () => {
    /* */
  },
});

export const CommandManagerProvider: React.FC<PropsWithChildren<Props>> = props => {
  // establish commands state
  const initialCommands: Commands = {};
  const [commands, setCommands] = useState(initialCommands);

  // establish menus state
  const initialMenus: EditorMenus = { format: [], insert: [], table: []};
  const [menus, setMenus] = useState(initialMenus);

  // command manager that enables reading commands and adding new ones
  const commandManager = {
    commands,
    menus,
    addCommands: (newCommands: Command[]) => {
      setCommands((prevCommands: Commands) => {
        // index commands by name
        const newCommandsById: Commands = {};
        newCommands.forEach(command => {
          newCommandsById[command.id] = command;
        });
        const commands = {
          ...prevCommands,
          ...newCommandsById,
        };
        return commands;
      });
    },
    setMenus: (menus: EditorMenus) => {
      setMenus(() => {
        return menus;
      })
    },
    execCommand: (id: CommandId) => {
      const command = commands[id];
      if (command) {
        command.execute();
      }
    },
  };

  return <CommandManagerContext.Provider value={commandManager}>{props.children}</CommandManagerContext.Provider>;
};

// https://stackoverflow.com/questions/50612299/react-typescript-consuming-context-via-hoc
// https://medium.com/@jrwebdev/react-higher-order-component-patterns-in-typescript-42278f7590fb
export function withCommandManager<P extends WithCommandManagerProps>(Component: React.ComponentType<P>) {
  return function CommandsComponent(props: Pick<P, Exclude<keyof P, keyof WithCommandManagerProps>>) {
    return (
      <CommandManagerContext.Consumer>
        {(commandManager: CommandManager) => {
          return <Component {...(props as P)} commandManager={commandManager} />;
        }}
      </CommandManagerContext.Consumer>
    );
  };
}

interface WithCommandManagerProps {
  commandManager: CommandManager;
}
