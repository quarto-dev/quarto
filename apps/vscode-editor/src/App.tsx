/*
 * Editor.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from "react";

import { Store } from 'redux';
import { Provider as StoreProvider } from 'react-redux';

import { HotkeysProvider } from "ui-widgets";

import { CommandManagerProvider } from "editor-ui";

import EditorContainer, { EditorContainerProps } from "./EditorContainer";


interface AppProps extends EditorContainerProps {
  store: Store;
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
  

