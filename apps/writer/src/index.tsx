/*
 * index.tsx
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
import { createRoot } from 'react-dom/client';

import { configureStore } from './store/store';

import { setEditorMarkdown } from './store/editor/editor-actions';

import Workbench from './workbench/Workbench';

import 'normalize.css/normalize.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import "@blueprintjs/popover2/lib/css/blueprint-popover2.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";
import { i18nInit } from './i18n';

async function runApp() {
  try {
    // configure store
    const store = configureStore();

    // initialize with content
    const contentUrl = `content/${window.location.search.slice(1) || 'MANUAL.md'}`;
    const markdown = await (await fetch(contentUrl)).text();
    store.dispatch(setEditorMarkdown(markdown));

     // init localization
     await i18nInit();

    // create root element and render
    const root = createRoot(document.getElementById('root')!);
    root.render(
      <Workbench store={store} />
    );
  } catch (error) {
    console.error(error);
  }
}

runApp();


