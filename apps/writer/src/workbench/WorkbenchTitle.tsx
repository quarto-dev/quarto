/*
 * WorkbenchTitle.tsx
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
import ReactDOM from 'react-dom';

import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import { EditableText } from '@blueprintjs/core';

import { editorLoading, editorTitle, setEditorTitle } from '../store/editor';

import { CommandManagerContext } from '../commands/CommandManager';
import { WorkbenchCommandId } from '../commands/commands';

import { focusInput } from '../widgets/utils';

import styles from './WorkbenchNavbar.module.scss';

const WorkbenchTitle: React.FC = () => {

  const { t } = useTranslation();
  const [, cmDispatch] = useContext(CommandManagerContext);
  const loading = useSelector(editorLoading);
  const title = useSelector(editorTitle);
  const dispatch = useDispatch();

  const inputRef = React.useRef<EditableText>(null);

  const focusTitleEditor = () => {
    if (inputRef.current) {
      // no ref property available on EditableText, so we need this hack:
      //  https://github.com/palantir/blueprint/issues/2492
      const editableText = ReactDOM.findDOMNode(inputRef.current) as Element;
      const editableTextInput = editableText!.querySelector('.bp4-editable-text-input');
        focusInput(editableTextInput as HTMLInputElement);
    }
  }

  const focusEditor = () => {
    // delay so the enter key doesn't go to the editor
    setTimeout(() => {
      cmDispatch({ type: "EXEC_COMMAND", payload: WorkbenchCommandId.ActivateEditor });
    }, 0);
  }

  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.Rename,
        menuText: t('commands:rename_menu_text'),
        group: t('commands:group_utilities'),
        keymap: [],
        isEnabled: () => true,
        isActive: () => false,
        execute: focusTitleEditor,
      },
    ]})
  }, []);

  return (
    <EditableText
      ref={inputRef}
      alwaysRenderInput={true}
      className={styles.title}
      placeholder={loading ? '' : t('untitled_document') as string}
      value={title}
      onChange={value => dispatch(setEditorTitle(value))}
      onCancel={focusEditor}
      onConfirm={focusEditor}
    />
  );
}

export default WorkbenchTitle;