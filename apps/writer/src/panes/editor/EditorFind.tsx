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
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // state
  const [active, setActive] = useState(false);
  const [isReplace, setIsReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.Find,
        menuText: t('commands:find_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Mod-f'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          if (!active) {
            setActive(true);
          }
          setIsReplace(false);
          focusInput(findInputRef.current);
        },
      },
      {
        id: WorkbenchCommandId.Replace,
        menuText: t('commands:replace_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Mod-Alt-f'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          if (!active) {
            setActive(true);
          }
          setIsReplace(true);
          focusInput(findInputRef.current); 
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
      <Button icon={IconNames.ChevronLeft} title={t('find_next') as string}  minimal={true} small={true} />
      <Button icon={IconNames.ChevronRight} title={t('find_previous') as string} minimal={true} small={true} />
    </span>;

  // show replace buttons when we have replace text
  const replaceButtons = 
    <span style={ { visibility: replaceText.length ? 'visible' : 'hidden' }}>
      <Button icon={IconNames.ChevronRight} title={t('replace_and_find') as string} minimal={true} small={true} />
      <Button icon={IconNames.DoubleChevronRight} title={t('replace_all') as string} minimal={true} small={true} />
    </span>;

  return (
    <CSSTransition nodeRef={nodeRef} in={active} timeout={200} classNames={{ ...styles }}
      onEntered={() =>focusInput(findInputRef.current)}
    >          
      <div ref={nodeRef} className={styles.findContainer}>
        <div className={styles.find}>
          <ControlGroup className={styles.findRow}>
            <InputGroup
              inputRef={findInputRef}
              value={findText}
              className={styles.findInput}
              onChange={(ev) => { setFindText(ev.target.value); debouncedPerformFind(); } }
              onKeyDown={handleKeyDown}
              small={true}
              placeholder={t('find_placeholder') as string}    
              rightElement={navButtons}
            />
            <Button icon={IconNames.Cross} title={t('find_close_panel') as string} minimal={true} small={true} onClick={close} />
          </ControlGroup>
          {isReplace ? <InputGroup
            inputRef={replaceInputRef}
            value={replaceText}
            onChange={ev => setReplaceText(ev.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.findInput}
            small={true}
            placeholder={t('replace_placeholder') as string}  
            rightElement={replaceButtons}
          /> : null}
        </div>
      </div>
    </CSSTransition>
  );
}

export default EditorFind;