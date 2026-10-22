/*
 * Editor.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from "react";

import { Provider as StoreProvider } from 'react-redux';

import { HotkeysProvider } from "ui-widgets";

import { CommandManagerProvider, EditorUIStore } from "editor-ui";

import EditorContainer, { EditorContainerProps } from "./EditorContainer";


interface AppProps extends EditorContainerProps {
  store: EditorUIStore;
  editorId: string;
}

export const App : React.FC<AppProps> = (props) => {


  return (
    <StoreProvider store={props.store}>
      <CommandManagerProvider>
        <HotkeysProvider>
          <EditorContainer {...props} />
        </HotkeysProvider>
      </CommandManagerProvider>
    </StoreProvider>
  );
}
  

