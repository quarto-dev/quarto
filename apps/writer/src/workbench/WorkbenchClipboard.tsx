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

import React, { useContext, useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import { CommandManagerContext, Command, keyCodeString, alert } from 'editor-ui';

import { WorkbenchCommandId } from './commands';
import { kAlertTypeWarning } from 'editor';

const WorkbenchClipboard: React.FC = () => {
   
  const { t } = useTranslation();
  const [, cmDispatch] = useContext(CommandManagerContext);

  const focusEditor = () => {
    cmDispatch({ type: "EXEC_COMMAND", payload: WorkbenchCommandId.ActivateEditor });
  }

  const clipboardCommand = (id: string, domId: string, menuText: string, keymap: string) : Command => {

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
          const message =
            <div>
              <p>{t('clipboard_dialog_title')}</p>
              <p>
                {t('clipboard_dialog_message', {
                  keycode: keyCodeString(keymap),
                  command: menuText,
                })}
              </p>
            </div>;
          alert(t('clipboard_dialog_caption'), message, kAlertTypeWarning);
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

  return <></>;
};

export default WorkbenchClipboard;
