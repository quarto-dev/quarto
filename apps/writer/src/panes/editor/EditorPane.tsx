/*
 * EditorPane.tsx
 *
 * Copyright (C) 2019-20 by RStudio, PBC
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

import React, { useCallback, useContext, useEffect, useRef } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import { Intent, Spinner } from '@blueprintjs/core';

import { 
  Editor, 
  EventType, 
  kAlertTypeError, 
  NavigationType,
  UpdateEvent, 
  OutlineChangeEvent, 
  StateChangeEvent,
  EditorFormat,
  kQuartoDocType,
  EditorDialogs
} from 'editor';

import {
  editorMarkdown,
  editorTitle,
  editorLoading,
  setEditorMarkdown,
  setEditorSelection,
  setEditorOutline,
  setEditorTitle,
  setEditorLoading,
} from '../../store/editor';
import { prefsShowMarkdown } from '../../store/prefs';

import { CommandManager, CommandManagerContext } from '../../commands/CommandManager';

import { Pane } from '../../widgets/Pane';

import { editorDialogs } from './dialogs/editor-dialogs';
import EditorDialogsImpl from './dialogs/EditorDialogsImpl';
import EditorOutlineSidebar from './outline/EditorOutlineSidebar';
import { editorContext } from './context/editor-context';

import { editorProsemirrorCommands, editorExternalCommands, editorDebugCommands } from './editor-commands';
import { EditorActions, EditorActionsContext } from './EditorActionsContext';
import EditorToolbar from './EditorToolbar';

import { PandocFormat } from 'editor/src/api/pandoc_format';

import styles from './EditorPane.module.scss';

const EditorPane : React.FC = () => {

  // global services
  const { t } = useTranslation();
  const commandManager = useContext(CommandManagerContext);

  // redux state
  const title = useSelector(editorTitle);
  const loading = useSelector(editorLoading);
  const markdown = useSelector(editorMarkdown);
  const showMarkdown = useSelector(prefsShowMarkdown);
  const dispatch = useDispatch();

  // refs we get from rendering
  const parentRef = useRef<HTMLDivElement>(null);
  const editorDialogsRef = useRef<EditorDialogsImpl>(null);

  // refs that hold out of band state 
  const editorRef = useRef<Editor | null>(null);
  const showMarkdownRef = useRef<boolean | null>(null);
 
  // subscribe/unsubscribe from editor events
  const editorEventsRef = useRef(new Array<VoidFunction>());
  function onEditorEvent<T>(event: EventType<T>, handler: (detail?: T) => void) {
    editorEventsRef.current.push(editorRef.current!.subscribe(event, handler));
  }
  const unregisterEditorEvents = () => {
    editorEventsRef.current.forEach(unregister => unregister());
  }

  // general helper functions
  const errorAlert = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    editorDialogsRef.current?.alert(message, t('error_alert_title') as string, kAlertTypeError);
  }

  // initialize the editor
  const initEditor = useCallback(async () => {
    
    editorRef.current = await createEditor(parentRef.current!, () => commandManager, editorDialogs(editorDialogsRef.current!));
    
    window.addEventListener("resize", onResize);

    showPandocWarnings(editorRef.current?.getPandocFormat());

    // subscribe to events
    onEditorEvent(UpdateEvent, onEditorDocChanged);
    onEditorEvent(OutlineChangeEvent, onEditorOutlineChanged);
    onEditorEvent(StateChangeEvent, onEditorStateChanged);

    // add commands
    commandManager.addCommands([
      ...editorProsemirrorCommands(editorRef.current!.commands()),
      ...editorExternalCommands(editorRef.current!),
      ...editorDebugCommands(editorRef.current!),
    ]);

    // set menus
    commandManager.setMenus(editorRef.current!.getMenus());

    // load editor
    await editorRef.current!.setMarkdown(markdown, panmirrorWriterOptions(), false);
    dispatch(setEditorTitle(editorRef.current?.getTitle() || ''));
    onEditorOutlineChanged();
    if (loading) {
      dispatch(setEditorLoading(false));
      editorRef.current?.focus();
    }
     
  }, []);

  // provide EditorActionsContext from editor 
  const editorActions: EditorActions = {
    focus: function (): void {
      editorRef.current?.focus();
    },
    navigate: function (id: string): void {
      editorRef.current?.navigate(NavigationType.Id, id);
    }
  }

  // when doc changes, propagate markdown only if showMarkdown is true (as
  // (this is an incredibly expensive operation to run on every keystroke!)
  const onEditorDocChanged = () => {
    if (showMarkdownRef.current) {
      saveMarkdown();
    }
    dispatch(setEditorTitle(editorRef.current?.getTitle() || ''));
  };

  // dispatch outline changes
  const onEditorOutlineChanged = () => {
     const outline = editorRef.current?.getOutline();
     if (outline) {
       dispatch(setEditorOutline(outline));
     }
  }

  // dispatch selection changes (allows command manager to update)
  const onEditorStateChanged = () => {
    dispatch(setEditorSelection(editorRef.current!.getSelection()));
  }

  // save editor markdown to the redux store
  const saveMarkdown = async () => {
    try {
      // generate markdown
      const markdown = await editorRef.current!.getMarkdown(panmirrorWriterOptions());
     
      // set markdown into redux
      dispatch(setEditorMarkdown(markdown.code));
     
    } catch (error) {
      errorAlert(error);
    }
  }

  // propagate window resize to editor
  const onResize = () => {
    editorRef.current?.resize();
  }

  // editor initialization
  useEffect(() => {
    initEditor().catch(error => {
      errorAlert(error);
    });

    return () => {
      unregisterEditorEvents();
      window.removeEventListener("resize", onResize);
    }
  }, []);

  // update editor title when it changes
  useEffect(() => {
    if (title !== editorRef.current?.getTitle()) {
      editorRef.current?.setTitle(title);
    }
  }, [title]);

  // update markdown in store when pref changes (also
  // note value for out-of-band editor changed callback)
  useEffect(() => {
    showMarkdownRef.current = showMarkdown;
    if (editorRef.current && showMarkdown) {
      saveMarkdown();
    }
  }, [showMarkdown]);

  // render
  return (
    <Pane className={'editor-pane'}>
      <EditorActionsContext.Provider value={editorActions}>
        <EditorToolbar />
        <div id="editor" className={styles.editorParent} ref={parentRef}>
          {editorLoadingUI(loading)}
          <EditorOutlineSidebar />
        </div>
        <EditorDialogsImpl ref={editorDialogsRef} />
      </EditorActionsContext.Provider>
    </Pane>
  );
}

const panmirrorWriterOptions = () => {
  return {
    atxHeaders: true
  };
}

const showPandocWarnings = (pandocFormat?: PandocFormat) => {
  const warnings = pandocFormat?.warnings;
  if (warnings?.invalidFormat) {
    // console.log('WARNING: invalid pandoc format ' + warnings.invalidFormat);
  }
  if (warnings?.invalidOptions.length) {
    // console.log(`WARNING: ${pandocFormat.baseName} does not support options: ${warnings.invalidOptions.join(', ')}`);
  }
}

const editorLoadingUI = (loading: boolean) => {
  if (loading) {
    return loading && (
      <div className={['ProseMirror', styles.editorLoading].join(' ')}>
        <div className='body pm-editing-root-node pm-text-color pm-background-color'>
          <Spinner className={styles.editorLoadingSpinner} intent={Intent.NONE} ></Spinner>
        </div>
      </div>
    )
  } else {
    return <div/>;
  }
}

const createEditor = async (
  parent: HTMLElement, 
  commandManager: () => CommandManager, 
  dialogs: EditorDialogs
) : Promise<Editor> => {
  const context = editorContext(commandManager, dialogs);
    const format: EditorFormat = {
      pandocMode: 'markdown',
      pandocExtensions: '',
      rmdExtensions: {
        codeChunks: true,
        bookdownPart: true,
        bookdownXRef: true
      },
      hugoExtensions: {
        shortcodes: true
      },
      docTypes: [kQuartoDocType]
    }
    return await Editor.create(parent, context, format, { 
      browserSpellCheck: true,
      commenting: true,
      outerScrollContainer: true 
    });
}

export default EditorPane;

