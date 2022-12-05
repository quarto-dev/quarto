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

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { CSSTransition } from 'react-transition-group';
import { useDebounce } from 'use-debounce';

import { Button, Checkbox, ControlGroup, InputGroup } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import { kAlertTypeInfo } from 'editor';


import { CommandManagerContext } from '../../commands/CommandManager';
import { WorkbenchCommandId } from '../../commands/commands';
import { focusInput } from '../../widgets/utils';
import { EditorDialogsContext } from './dialogs/EditorDialogsProvider';
import { EditorActionsContext } from './EditorActionsContext';

import styles from './EditorFind.module.scss';

const EditorFind: React.FC = () => {

  // translations and commands
  const { t } = useTranslation();
  const [, cmDispatch] = useContext(CommandManagerContext);

  // contexts
  const editorActions = useContext(EditorActionsContext);
  const editorDialogs = useContext(EditorDialogsContext);

  // refs
  const nodeRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  // state
  const [active, setActive] = useState(false);
  const [findText, setFindText] = useState("");
  const [debouncedFindText] = useDebounce(findText, 200);
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchRegex, setMatchRegex] = useState(false);


  // find and replace commands
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
          focusInput(findInputRef.current);
        }
      }
    ]})
  }, [active]);

  // close panel
  const close = () => {
    setActive(false);
  }

  // no more matches alert
  const noMoreMatchesAlert = () => {
    editorDialogs.alert(t('find_no_more_matches'), t('find_alert_title'), kAlertTypeInfo);
  }

  // perform find (debounce find text changes)
  useEffect(() => {
    editorActions.findReplace()?.find(findText, {
      caseSensitive: matchCase,
      regex: matchRegex,
      wrap: true
    });
  }, [debouncedFindText, matchCase, matchRegex])
 
  // find next
  const findNext = () => {
    if (!editorActions.findReplace()?.selectNext()) {
      noMoreMatchesAlert();
    }
  }

  // find previous 
  const findPrevious = () => {
    if (!editorActions.findReplace()?.selectPrevious()) {
      noMoreMatchesAlert();
    }
  }

  // replace and find
  const replaceAndFind = useCallback(() => {
    if (!editorActions.findReplace()?.replace(replaceText)) {
      noMoreMatchesAlert();
    }
  }, [replaceText]);

  // replace all
  const replaceAll = useCallback(() => {
    const replaced = editorActions.findReplace()?.replaceAll(replaceText);
    editorDialogs.alert(`${(replaced || 0)} ${t('find_instances_replaced')}.`, t('find_alert_title'), kAlertTypeInfo);
  }, [replaceText]);
  
  // keyboard shortcuts
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
      <Button icon={IconNames.ChevronLeft} title={t('find_previous') as string} onClick={findPrevious} minimal={true} small={true} />
      <Button icon={IconNames.ChevronRight} title={t('find_next') as string} onClick={findNext} minimal={true} small={true} />
    </span>;

  // show replace buttons when we have replace text
  const replaceButtons = 
    <span style={ { visibility: replaceText.length ? 'visible' : 'hidden' }}>
      <Button icon={IconNames.ChevronRight} title={t('replace_and_find') as string} onClick={replaceAndFind} minimal={true} small={true} />
      <Button icon={IconNames.DoubleChevronRight} title={t('replace_all') as string} onClick={replaceAll} minimal={true} small={true} />
    </span>;

  // component
  return (
    <CSSTransition nodeRef={nodeRef} in={active} timeout={300} classNames={{ ...styles }}
      onEntered={() =>focusInput(findInputRef.current)}
    >          
      <div ref={nodeRef} className={styles.findContainer}>
        <div className={styles.find}>
          <ControlGroup className={styles.findRow}>
            <InputGroup
              inputRef={findInputRef}
              className={styles.findInput}
              value={findText}
              onChange={ev => setFindText(ev.target.value)}
              onKeyDown={handleKeyDown}
              small={true}
              placeholder={t('find_placeholder') as string}    
              rightElement={navButtons}
            />
            <Button icon={IconNames.Cross} title={t('find_close_panel') as string} minimal={true} small={true} onClick={close} />
          </ControlGroup>
          <InputGroup
            className={[styles.findInput, styles.findRow].join(' ')}
            value={replaceText}
            onChange={ev => setReplaceText(ev.target.value)}
            onKeyDown={handleKeyDown}
            small={true}
            placeholder={t('replace_placeholder') as string}  
            rightElement={replaceButtons}
          /> 
          <Checkbox checked={matchCase} onChange={ev => setMatchCase(ev.currentTarget.checked)} label={t('find_match_case') as string} /> 
          <Checkbox checked={matchRegex} onChange={ev => setMatchRegex(ev.currentTarget.checked)} label={t('find_match_regex') as string} /> 
        </div>
      </div>
    </CSSTransition>
  );
}

export default EditorFind;