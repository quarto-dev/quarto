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

import { focusInput } from 'core-browser';

import { kAlertTypeInfo, UITools } from 'editor';

import { EditorActionsContext, editorDialogs, EditorUICommandId } from "editor-ui";

import { CommandManagerContext } from 'editor-ui';

import styles from './EditorFind.module.scss';


const EditorFind: React.FC = () => {

  // translations and commands
  const { t } = useTranslation();
  const [, cmDispatch] = useContext(CommandManagerContext);

  // contexts
  const editorActions = useContext(EditorActionsContext);

  // refs
  const nodeRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const uiToolsRef = useRef<UITools>(new UITools());
  const dialogs = useRef(editorDialogs(uiToolsRef.current.attr));

  // state
  const [active, setActive] = useState(false);
  const [findText, setFindText] = useState("");
  const [debouncedFindText] = useDebounce(findText, 200);
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchRegex, setMatchRegex] = useState(false);

   // close panel
   const close = () => {
    setActive(false);
  }

  // focus find input
  const focusFindInput = () => {
    focusInput(findInputRef.current);
  }

  // no more matches alert
  const noMoreMatchesAlert = () => {
    dialogs.current.alert(t('find_alert_title'), t('find_no_more_matches'), kAlertTypeInfo);
  }

  // perform most up to date find
  const performFind = useCallback(() => {
    const find = editorActions.findReplace();
    find?.find(findText, {
      caseSensitive: matchCase,
      regex: matchRegex,
      wrap: true
    });
    find?.selectCurrent();
    return find;
  }, [findText, matchCase, matchRegex]);

  // find next
  const findNext = useCallback(() => {
    if (!performFind()?.selectNext()) {
      noMoreMatchesAlert();
    }
  }, [performFind]);

  // find previous 
  const findPrevious = useCallback(() => {
    if (!performFind()?.selectPrevious()) {
      noMoreMatchesAlert();
    }
  }, [performFind]);

  // replace and find
  const replaceAndFind = useCallback(() => {
    if (!performFind()?.replace(replaceText)) {
      noMoreMatchesAlert();
    }
  }, [performFind, replaceText]);

  // replace all
  const replaceAll = useCallback(() => {
    const replaced = performFind()?.replaceAll(replaceText);
    dialogs.current.alert( t('find_alert_title'), `${(replaced || 0)} ${t('find_instances_replaced')}.`, kAlertTypeInfo);
  }, [performFind, replaceText]);
  
  // find and replace commands
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: EditorUICommandId.Find,
        menuText: t('commands:find_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Mod-f'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          if (!active) {
            setActive(true);
          }
          focusFindInput();
        }
      },
      {
        id: EditorUICommandId.FindNext,
        menuText: t('commands:find_next_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Ctrl-g'],
        isEnabled: () => active,
        isActive: () => false,
        execute: findNext
      },
      {
        id: EditorUICommandId.FindPrevious,
        menuText: t('commands:find_previous_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Mod-Shift-g'],
        isEnabled: () => active,
        isActive: () => false,
        execute: findPrevious
      }
    ]})
  }, [active, findNext, findPrevious]);

  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: EditorUICommandId.ReplaceAndFind,
        menuText: t('commands:replace_and_find_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Mod-Shift-j'],
        isEnabled: () => active && replaceText.length > 0,
        isActive: () => false,
        execute: replaceAndFind
      }
    ]})
  }, [active, replaceText, replaceAndFind]);


   // perform find when find text changes (debounced)
  useEffect(() => {
    performFind();
  }, [debouncedFindText, matchCase, matchRegex]);

  // clear search when we go inactive
  useEffect(() => {
    editorActions.findReplace()?.clear();
  }, [active])

  // keyboard shortcuts
  const handleFindKeyDown = useCallback((ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      findNext();
    } else if (ev.key == 'Escape') {
      close();
    } 
  }, [findNext]);
  const handleReplaceKeyDown = useCallback((ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      replaceAndFind();
    } else if (ev.key == 'Escape') {
      close();
    } 
  }, [replaceAndFind]);
  
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
              onKeyDown={handleFindKeyDown}
              onFocus={performFind}
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
            onKeyDown={handleReplaceKeyDown}
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