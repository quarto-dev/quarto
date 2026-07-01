/*
 * index.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React from "react";
import { createRoot } from 'react-dom/client';

import * as uuid from "uuid";

import 'vscode-webview';

import { addEditor, initEditorTranslations, initializeStore, setEditorTheme } from 'editor-ui';

import { App } from "./App";
import { visualEditorHostClient, visualEditorJsonRpcRequestTransport } from './sync';
import { editorThemeFromStore } from "./theme";

import "editor-ui/src/styles";
import "./styles.scss"

async function runEditor() {
  try {
    // init localization
    await initEditorTranslations();

    // connection to host
    const vscode = acquireVsCodeApi<unknown>();
    const request = visualEditorJsonRpcRequestTransport(vscode)
    const host = visualEditorHostClient(vscode, request);

    // get host context
    const context = await host.getHostContext();

    // initialize store and read initial prefs
    const store = await initializeStore(request);

    // create editor id
    const editorId = uuid.v4();
    store.dispatch(addEditor(editorId));

    // render
    const root = createRoot(document.getElementById('root')!);
    setEditorTheme(editorThemeFromStore(store));
    root.render(<App store={store} editorId={editorId} host={host} context={context} request={request}/>);
  } catch (error) {
    console.error(error);
  }
}

runEditor();


