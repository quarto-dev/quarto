/*
 * WorkbenchClipboard.tsx
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

import React, { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { WorkbenchCommandId, CommandId, Command } from '../commands/commands';
import { CommandManagerContext } from '../commands/CommandManager';
import { keyCodeString } from '../commands/keycodes';

import { AlertDialog } from '../widgets/dialog/AlertDialog';
import { kAlertTypeWarning } from 'editor';

interface WorkbenchClipboardState {
  dialogIsOpen: boolean;
  commandMenuText?: string;
  commandKeycode?: string;
}

const WorkbenchClipboard: React.FC = () => {

  const [state, setState] = useState<WorkbenchClipboardState>({ dialogIsOpen: false });
   
  const { t } = useTranslation();
  const [, cmDispatch] = useContext(CommandManagerContext);

  const focusEditor = () => {
    cmDispatch({ type: "EXEC_COMMAND", payload: WorkbenchCommandId.ActivateEditor });
  }

  const onDialogClosed = () => {
    setState({ dialogIsOpen: false });
    focusEditor();
  }

  const clipboardCommand = (id: CommandId, domId: string, menuText: string, keymap: string) : Command => {

    const openDialog = () => {
      setState({
        dialogIsOpen: true,
        commandMenuText: menuText,
        commandKeycode: keyCodeString(keymap),
      });
    };

    return {
      id,
      menuText,
      group: t('commands:group_text_editing'),
      keymap: [keymap],
      keysUnbound: true,
      isEnabled: () => !document.queryCommandSupported(domId) || document.queryCommandEnabled(domId),
      isActive: () => false,
      execute: () => {
        if (document.queryCommandSupported(domId) && document.execCommand(domId)) {
          focusEditor();
        } else {
          openDialog();
        }
      },
    };
  }

  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      clipboardCommand(WorkbenchCommandId.Copy, 'copy', t('commands:copy_menu_text'), 'Mod-c'),
      clipboardCommand(WorkbenchCommandId.Cut, 'cut', t('commands:cut_menu_text'), 'Mod-x'),
      clipboardCommand(WorkbenchCommandId.Paste, 'paste', t('commands:paste_menu_text'), 'Mod-v'),
    ]});
  }, []);

  return (
    <AlertDialog
      title={'Use Keyboard Shortcut'}
      message={'the message'}
      type={kAlertTypeWarning}
      isOpen={state.dialogIsOpen}
      onClosed={onDialogClosed}
    >
      <p>{t('clipboard_dialog_title')}</p>
      <p>
        {t('clipboard_dialog_message', {
          keycode: state.commandKeycode,
          command: state.commandMenuText,
        })}
      </p>
    </AlertDialog>
  );

};

export default WorkbenchClipboard;
