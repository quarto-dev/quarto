/*
 * MarkdownPane.tsx
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

import React, { useContext, useEffect, useRef, useState } from 'react';

import { useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import { IconNames } from '@blueprintjs/icons';

import { EditorView, basicSetup } from 'codemirror';
import { markdown as markdownLang } from "@codemirror/lang-markdown"

import { editorMarkdown } from '../../store/editor';

import { CommandManagerContext, Toolbar, ToolbarText, ToolbarButton  } from 'editor-ui';

import { Pane } from '../../widgets/Pane';

import styles from './MarkdownPane.module.scss';
import { useGetPrefsQuery, useSetPrefsMutation } from '../../store/prefs';
import { defaultPrefs } from 'writer-types';
import { WorkbenchCommandId } from '../../workbench/commands';

const MarkdownPane: React.FC = () => {

  const { t } = useTranslation();
  const [,cmDispatch] = useContext(CommandManagerContext);
  const markdown = useSelector(editorMarkdown);

  const { data: prefs = defaultPrefs() } = useGetPrefsQuery();
  const [setPrefs] = useSetPrefsMutation();


  const onCloseClicked = () => {
    setPrefs({...prefs, showMarkdown: false });
  }

  // add commands on initial mount (note that the callbacks are run
  // outside of the flow of this component's render so need to 
  // access the store directly)
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.ShowMarkdown,
        menuText: t('commands:show_markdown_menu_text'),
        group: t('commands:group_view'),
        keymap: ['Ctrl-Alt-M'],
        isEnabled: () => true,
        isActive: () => prefs.showMarkdown,
        execute: () => {
          setPrefs({...prefs, showMarkdown: !prefs.showMarkdown });
        },
      },
    ]});
  }, [prefs.showMarkdown]);

  // codemirror instance
  const cmRef = useRef<HTMLDivElement>(null);
  const [cm, setCm] = useState<EditorView>();
  
  // init/destroy codemirror instance on mount/unmount
  useEffect(() => {
    setCm(new EditorView({
      extensions: [basicSetup, markdownLang(), EditorView.lineWrapping, EditorView.editable.of(false)],
      parent: cmRef.current || undefined
    }));
    return () => {
      cm?.destroy();
    }
  }, []);
 
  // update codemirror and save showMarkdown on render
  useEffect(() => {
    cm?.dispatch({
      changes: { from: 0, to: cm?.state.doc.length, insert: markdown }
    })
  });

  return (
    <Pane className={['markdown-pane', styles.pane].concat(prefs.showMarkdown ? ['markdown-visible'] : [] ).join(' ')}>
      <Toolbar className={styles.toolbar}>
        <ToolbarText>{t('markdown_pane_caption')}</ToolbarText>
        <ToolbarButton
          title={t('close_button_title')}
          className={styles.closeButton}
          icon={IconNames.SMALL_CROSS}
          enabled={true}
          active={false}
          onClick={onCloseClicked}
        />
      </Toolbar>
      <div className={styles.codemirrorParent} ref={cmRef} />
    </Pane>
  );

};

export default MarkdownPane;

