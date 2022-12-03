/*
 * WorkbenchPrefsDialog.tsx
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

import { FormGroup, HTMLSelect } from '@blueprintjs/core';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultPrefs } from 'writer-types';

import { useGetAvailableDictionariesQuery } from '../store/dictionary';
import { useGetPrefsQuery, useSetPrefsMutation } from '../store/prefs';

import { CommandManagerContext } from '../commands/CommandManager';
import { WorkbenchCommandId } from '../commands/commands';

import { Dialog } from '../widgets/dialog/Dialog';

export const WorkbenchPrefsDialog: React.FC = () => {

  // translations
  const { t } = useTranslation();

  // command to show dialog
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [, cmDispatch] = useContext(CommandManagerContext);
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.Prefs,
        menuText: t('commands:prefs_menu_text'),
        group: t('commands:group_utilities'),
        keymap: [],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          setIsOpen(true);
        },
      },
    ]})
  }, []);


  // queries/mutations
  const { data: prefs = defaultPrefs() } = useGetPrefsQuery();
  const [ setPrefs ] = useSetPrefsMutation();
  const { data: dictionaries } = useGetAvailableDictionariesQuery();

  // state for controlled components
  const [dictionaryLocale, setDictionaryLocale] = useState(prefs.dictionaryLocale);

  // close dialog
  const closeDialog = () => {
    setIsOpen(false);
    cmDispatch({ type: "EXEC_COMMAND", payload: WorkbenchCommandId.ActivateEditor });
  }

  // ok handler (save state to prefs)
  const onOK = () => {
    setPrefs( { ...prefs, dictionaryLocale })
    closeDialog();
  }

  return (
    <Dialog
      isOpen={isOpen}
      title={t('prefs_dialog_caption') as string}
      onCancel={closeDialog}
      onOK={onOK}
    >
       <FormGroup label={t('prefs_dialog_dictionary_locale')}>
          <HTMLSelect 
            fill={true} 
            value={dictionaryLocale}
            onChange={ev => setDictionaryLocale(ev.currentTarget.value)}
            options={dictionaries 
              ? dictionaries.map(dictionary => ({
                  value: dictionary.locale,
                  label: dictionary.name
                }))
              : [ { value: prefs.dictionaryLocale } ]
            } 
          />
       </FormGroup>
    </Dialog>
  );
};





