/*
 * App.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import React from 'react';

import { Store } from 'redux';
import { Provider as StoreProvider } from 'react-redux';

import { Workbench, WorkbenchProps } from './workbench/Workbench';
import { CommandManagerProvider, fluentTheme } from 'editor-ui';
import { HotkeysProvider } from 'ui-widgets';
import { FluentProvider } from '@fluentui/react-components';

interface AppProps {
  editorId: string;
  editor2Id?: string;
  store: Store;
}

const App: React.FC<AppProps> = props => {

  // render
  return (
    <StoreProvider store={props.store}>
      <FluentProvider theme={fluentTheme()}> 
        {props.editor2Id 
          ? <>
              <Document 
                editorId={props.editorId} 
                collab={true} 
                style={{ bottom: "50%" }} 
              />
              <Document 
                editorId={props.editor2Id} 
                collab={true} 
                style={{ top: "50%", borderTop: "1px solid var(--colorNeutralStroke2)" }} 
              />
            </>
          : <Document editorId={props.editorId} />
        }
       
      </FluentProvider> 
    </StoreProvider>
  );
}



const Document: React.FC<WorkbenchProps> = props => {
  return (
    <CommandManagerProvider>
      <HotkeysProvider>
        <Workbench {...props}/>
      </HotkeysProvider>
    </CommandManagerProvider>
  )
}


export default App;

