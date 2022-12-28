/*
 * editor.ts
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

import throttle from "lodash.throttle";

import { Editor, EditorFormat, EditorHooks, kQuartoDocType, UpdateEvent } from "editor";

import { VisualEditorHostClient, visualEditorHostServer } from "../connection";

import { editorContext } from "./context";

export function createEditor(parent: HTMLElement, host: VisualEditorHostClient) {

  // editable hook (update after we get initial payload)
  let editable = false;
  const hooks: EditorHooks = {
    isEditable: () => editable 
  }

  // create context
  const context = editorContext(host.server, host.services, hooks);

  Editor.create(parent, context, quartoEditorFormat()).then(async (editor) => {
    
    // sync from text editor (throttled)
    const kThrottleDelayMs = 1000;
    const receiveEdit = throttle((markdown) => {
      editor.setMarkdown(markdown, quartoWriterOptions(), false)
        .finally(() => {
          // done
        });
    }, kThrottleDelayMs, { leading: false, trailing: true});

    // setup communication channel for host
    visualEditorHostServer(host.vscode, {
      async init(markdown: string) {

        // put editor in writeable mode
        editable = true;

        // init editor contents and sync cannonical version back to text editor
        const result = await editor.setMarkdown(markdown, quartoWriterOptions(), false);
        
        // visual editor => text editor (just send the state, host will call back for markdown)
        editor.subscribe(UpdateEvent, () => host.onEditorUpdated(editor.getStateJson()));

        // return canonical markdown
        return result.canonical;        
      },

      async applyExternalEdit(markdown: string) {
        // only receive external text edits if we don't have focus (prevents circular updates)
        if (!editor.hasFocus() && !window.document.hasFocus()) {
          receiveEdit(markdown);
        }
      },

      async getMarkdownFromState(state: unknown) : Promise<string> {
        return editor.getMarkdownFromStateJson(state, quartoWriterOptions());
      },
    })

    // let the host know we are ready
    await host.onEditorReady();    

  });

}

function quartoWriterOptions() {
  return { 
    atxHeaders: true 
  };
}

function quartoEditorFormat() : EditorFormat {
  return  {
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
}