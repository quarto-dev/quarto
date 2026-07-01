/*
 * EditorOperationsContext.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from 'react';

import { EditorOperations } from 'editor';

export const EditorOperationsContext = React.createContext<EditorOperations>(null!);

export function withEditorOperations<P extends WithEditorOperationsProps>(Component: React.ComponentType<P>) {
  return function EditorOperationsComponent(props: Pick<P, Exclude<keyof P, keyof WithEditorOperationsProps>>) {
    return (
      <EditorOperationsContext.Consumer>
        {(editor: EditorOperations) => <Component {...(props as P)} editor={editor} />}
      </EditorOperationsContext.Consumer>
    );
  };
}

interface WithEditorOperationsProps {
  editor: EditorOperations;
}
