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

import React, { useContext, useEffect, useState } from 'react';

import { FormikDialog, FormikHTMLSelect } from 'ui-widgets';

import { 
  CommandManagerContext, 
  useGetPrefsQuery, 
  useSetPrefsMutation, 
  useGetAvailableDictionariesQuery, 
  EditorUICommandId,
  t
} from 'editor-ui';

import { defaultPrefs, Prefs } from 'editor-types';

import { WorkbenchCommandId } from './commands';

export const WorkbenchPrefsDialog: React.FC = () => {
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
 
  const close = (prefs?: Prefs) => {
    setIsOpen(false);
    if (prefs) {
      setPrefs(prefs)
    }
    cmDispatch({ type: "EXEC_COMMAND", payload: EditorUICommandId.ActivateEditor });
  }

  return (
    <FormikDialog
      isOpen={isOpen}
      title={t('prefs_dialog_caption') as string}
      initialValues={prefs}
      onSubmit={close}
      onReset={() => close()}
    >
      <FormikHTMLSelect 
        name={'dictionaryLocale'} 
        label={t('prefs_dialog_dictionary_locale')} 
        options={dictionaries 
          ? dictionaries.map(dictionary => ({
              value: dictionary.locale,
              label: dictionary.name
            }))
          : [ { value: prefs.dictionaryLocale } ]
        } 
      />
    </FormikDialog>
  );
};





