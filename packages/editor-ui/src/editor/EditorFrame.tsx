/*
 * Editor.tsx
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


import React, { PropsWithChildren, useCallback, useContext, useEffect, useRef } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import { Intent, Spinner } from '@blueprintjs/core';

import { JsonRpcRequestTransport } from 'core';

import { defaultPrefs, Prefs } from 'editor-types';

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
  PandocFormat,
  EditorUISpelling,
  UITools,
  EditorDisplay,
  EditorUIContext,
  EditorOperations,
  EventHandler,
  PandocWriterOptions
} from 'editor';

import { 
  CommandManagerContext, 
  Commands 
} from '../commands';

import { editorDialogs } from '../dialogs';

import { 
  editorLoading, 
  editorMarkdown, 
  editorTitle, 
  setEditorLoading, 
  setEditorOutline, 
  setEditorSelection, 
  setEditorTitle, 
  useGetPrefsQuery, 
  useSetPrefsMutation 
} from '../store';

import { 
  editorContext, 
  EditorProviders, 
  useEditorSpelling 
} from '../context';

import { 
  editorProsemirrorCommands, 
  editorExternalCommands, 
  editorDebugCommands 
} from './editor-commands';

import { EditorOperationsContext } from './EditorOperationsContext';

import styles from './EditorFrame.module.scss';

export interface EditorFrameProps {
  className: string;
  display: (commands: () => Commands) => EditorDisplay;
  uiContext: EditorUIContext;
  request: JsonRpcRequestTransport;
}

export const EditorFrame : React.FC<PropsWithChildren<EditorFrameProps>> = (props) => {

  // global services
  const { t } = useTranslation();
  const [cmState, cmDispatch] = useContext(CommandManagerContext);
  const uiToolsRef = useRef<UITools>(new UITools());
  const dialogs = useRef(editorDialogs(uiToolsRef.current.attr));

  // redux state
  const title = useSelector(editorTitle);
  const loading = useSelector(editorLoading);
  const markdown = useSelector(editorMarkdown);
  const dispatch = useDispatch();

  const { data: prefs = defaultPrefs() } = useGetPrefsQuery();
  const [setPrefs] = useSetPrefsMutation();
 
  // refs we get from rendering
  const parentRef = useRef<HTMLDivElement>(null);

  // refs that hold out of band state 
  // https://stackoverflow.com/questions/57847594/react-hooks-accessing-up-to-date-state-from-within-a-callback
  const editorRef = useRef<Editor | null>(null);
  const commandsRef = useRef<Commands | null>(null);
  const prefsRef = useRef<Prefs | null>(defaultPrefs());
  const spellingRef = useRef<EditorUISpelling | null>(null);
 
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
    dialogs.current.alert( t('error_alert_title') as string, message, kAlertTypeError);
  }

  // keep spelling provider up to date 
  // TODO: add context once we have a relationship to the filesystem
  spellingRef.current = useEditorSpelling("(Untitled)", { 
    invalidateWord: (word: string) => editorRef.current?.spellingInvalidateWord(word),
    invalidateAllWords: () => editorRef.current?.spellingInvalidateAllWords() 
  });

  // initialize the editor
  const initEditor = useCallback(async () => {
    
    // create prefs provider
    const editorPrefs = { 
      prefs(): Prefs {
        return prefsRef.current || defaultPrefs();
      },
      setPrefs: function (prefs: Record<string,unknown>): void {
        setPrefs({ ...prefsRef.current!, ...prefs });
      }
    };

    editorRef.current = await createEditor(
      parentRef.current!, 
      {
        prefs: editorPrefs,
        request: props.request,
        uiContext: props.uiContext,
        display: () => props.display(() => commandsRef.current!), 
        dialogs: () => dialogs.current,
        spelling: () => spellingRef.current!
      }
    );
    
    window.addEventListener("resize", onResize);

    showPandocWarnings(editorRef.current?.getPandocFormat());

    // subscribe to events
    onEditorEvent(UpdateEvent, onEditorDocChanged);
    onEditorEvent(OutlineChangeEvent, onEditorOutlineChanged);
    onEditorEvent(StateChangeEvent, onEditorStateChanged);

    // add commands
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      ...editorProsemirrorCommands(editorRef.current!.commands()),
      ...editorExternalCommands(editorRef.current!),
      ...editorDebugCommands(editorRef.current!),
    ]});

    // set menus
    cmDispatch({ type: "SET_MENUS", payload: editorRef.current!.getMenus()});

    // load editor
    await editorRef.current!.setMarkdown(markdown, panmirrorWriterOptions(), false);
    dispatch(setEditorTitle(editorRef.current?.getTitle() || ''));
    onEditorOutlineChanged();
    if (loading) {
      dispatch(setEditorLoading(false));
      editorRef.current?.focus();
    }
     
  }, []);

  // provide EditorOperations -- we need to provide a fully bound instance
  // of EditorOperations to EditorOperationsContext _before_ we've actually
  // created the editor -- this bit of indirection handles this by delegating
  // to editorRef.current!  
  const editor: EditorOperations = {
    setTitle(title: string) {
     editorRef.current!.setTitle(title)
    },
    setMarkdown(markdown: string, options: PandocWriterOptions, emitUpdate: boolean) {
      return editorRef.current!.setMarkdown(markdown, options, emitUpdate);
    },
    getStateJson() {
      return editorRef.current!.getStateJson();
    },
    getMarkdownFromStateJson(stateJson: unknown, options: PandocWriterOptions) {
      return editorRef.current!.getMarkdownFromStateJson(stateJson, options);
    },
    getMarkdown(options: PandocWriterOptions) {
      return editorRef.current!.getMarkdown(options);
    },
    getFindReplace() {
      return editorRef.current?.getFindReplace();
    },
    focus() {
      editorRef.current?.focus();
    },
    navigate(type: NavigationType, id: string) {
      editorRef.current?.navigate(type, id);
    },
    subscribe<TDetail>(event: string | EventType<TDetail>, handler: EventHandler<TDetail>) {
      return editorRef.current!.subscribe(event, handler);
    }
  }

  // when doc changes propagate title
  const onEditorDocChanged = () => {
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
    const selection = editorRef.current!.getSelection();
    cmDispatch( { type: "SET_SELECTION", payload: selection } );
    dispatch(setEditorSelection(selection));
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

  // update commands ref when it changes
  useEffect(() => {
    commandsRef.current = cmState.commands;
  }, [cmState.commands])

  // update out of band ref to prefs when they change
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // render
  return (
    <EditorOperationsContext.Provider value={editor}> 
      <div id="editor" className={props.className} ref={parentRef}>
        {editorLoadingUI(loading)}
        {props.children}
      </div>
    </EditorOperationsContext.Provider>
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
  providers: EditorProviders
) : Promise<Editor> => {
  const context = editorContext(providers);
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
    browserSpellCheck: false,
    commenting: false,
    outerScrollContainer: true 
  });
}


