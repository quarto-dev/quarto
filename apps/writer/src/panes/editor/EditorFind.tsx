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

import { Button, ControlGroup, InputGroup } from '@blueprintjs/core';
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

  // refs
  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // state
  const [active, setActive] = useState(false);
  const [findText, setFindText] = useState("");

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
          if (!active)
            setActive(true);
          focusInput(inputRef.current);
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
          // 
        },
      },
    ]})
  }, [active]);

  // close panel
  const close = () => {
    setActive(false);
  }

  // perform find
  const performFind = () => {
    editorActions.findReplace().find(findText, {});
  }

  const findNext = () => {
    editorActions.findReplace().selectNext();
  }

  // debounced onChange handler for find
  const debouncedPerformFind = useCallback(
    debounce(performFind, 300)
  , [findText]);

  
  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      findNext();
    } else if (ev.key == 'Escape') {
      close();
    }
  }
  
  // show nav buttons when we have find text
  const navButtons = 
    <span style={ { visibility: findText.length ? 'visible' : 'hidden' }}>
      <Button icon={IconNames.ChevronLeft} minimal={true} small={true} />
      <Button icon={IconNames.ChevronRight} minimal={true} small={true} />
    </span>;

  return (
    <CSSTransition nodeRef={nodeRef} in={active} timeout={200} classNames={{ ...styles }}
      onEntered={() =>focusInput(inputRef.current)}
    >          
      <div ref={nodeRef} className={styles.findContainer}>
        <div className={styles.find}>
          <ControlGroup className={styles.findRow}>
            <InputGroup
              inputRef={inputRef}
              value={findText}
              className={styles.findInput}
              onChange={(ev) => { setFindText(ev.target.value); debouncedPerformFind(); } }
              onKeyDown={handleKeyDown}
              small={true}
              placeholder={t('find_placeholder') as string}    
              rightElement={navButtons}
            />
            <Button icon={IconNames.Cross} minimal={true} small={true} onClick={close} />
          </ControlGroup>
          <InputGroup
            className={styles.findInput}
            small={true}
            placeholder={t('replace_placeholder') as string}  
          />
        </div>
      </div>
    </CSSTransition>
  );
}

export default EditorFind;