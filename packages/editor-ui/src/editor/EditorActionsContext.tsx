/*
 * EditorActionsContext.tsx
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

import React from 'react';

import { EditorFindReplace, NavigationType } from 'editor';

export interface EditorActions {
  focus(): void;
  navigate(type: NavigationType, id: string): void;
  findReplace() : EditorFindReplace | undefined
}

export const EditorActionsContext = React.createContext<EditorActions>(null!);

export function withEditorActions<P extends WithEditorActionsProps>(Component: React.ComponentType<P>) {
  return function CommandsComponent(props: Pick<P, Exclude<keyof P, keyof WithEditorActionsProps>>) {
    return (
      <EditorActionsContext.Consumer>
        {(editorActions: EditorActions) => <Component {...(props as P)} editorActions={editorActions} />}
      </EditorActionsContext.Consumer>
    );
  };
}

interface WithEditorActionsProps {
  editorActions: EditorActions;
}
