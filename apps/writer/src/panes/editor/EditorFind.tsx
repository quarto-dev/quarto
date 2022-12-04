/*
 * EditorFind.tsx
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

import { InputGroup } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import debounce from 'lodash.debounce';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { CSSTransition } from 'react-transition-group';


import { CommandManagerContext } from '../../commands/CommandManager';
import { WorkbenchCommandId } from '../../commands/commands';
import { focusInput } from '../../widgets/utils';
import { EditorActionsContext } from './EditorActionsContext';

import styles from './EditorFind.module.scss';

const EditorFind: React.FC = () => {

  // translations and commands
  const { t } = useTranslation();
  const [, cmDispatch] = useContext(CommandManagerContext);

  // editor actions context
  const editorActions = useContext(EditorActionsContext);

  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [active, setActive] = useState(false);

  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.Find,
        menuText: t('commands:find_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Ctrl-Alt-f'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          if (active)
            focusInput(inputRef.current);
          else
            setActive(true);
        },
      },
      {
        id: WorkbenchCommandId.Replace,
        menuText: t('commands:replace_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Ctrl-Alt-r'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          if (active)
            focusInput(inputRef.current);
          else
            setActive(true);
        },
      },
    ]})
  }, [active]);

  // debounced onChange handler for find
  const debouncedFindHandler = useCallback(
    debounce((ev: React.ChangeEvent<HTMLInputElement>) => {
      editorActions.findReplace().find(ev.target.value, {});
    }, 300)
  , []);

  return (
    <CSSTransition nodeRef={nodeRef} in={active} timeout={200} classNames={{ ...styles }}
      onEntered={() =>focusInput(inputRef.current)}
    >          
      <div ref={nodeRef} className={styles.findContainer}>
        <div className={styles.find}>
          <InputGroup
            inputRef={inputRef}
            leftIcon={IconNames.Search}
            onChange={debouncedFindHandler}
            small={true}
            fill={true}
            placeholder={t('find_placeholder') as string}    
          />
        </div>
      </div>
    </CSSTransition>
  );
}

export default EditorFind;