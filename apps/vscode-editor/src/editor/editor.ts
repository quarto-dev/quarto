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

import { Editor, EditorFormat, EditorHooks, kQuartoDocType, UpdateEvent } from "editor";
import throttle from "lodash.throttle";

import { editorContext } from "./context";
import { VisualEditorHostClient, visualEditorHostServer } from "../connection";




export function createEditor(parent: HTMLElement, host: VisualEditorHostClient){

  // editable hook (update after we get initial payload)
  let loaded = false;
  const hooks: EditorHooks = {
    isEditable: () => loaded 
  }

  // create context
  const context = editorContext(host.server, hooks);

  Editor.create(parent, context, quartoEditorFormat()).then(async (editor) => {
    
    // throttle updates both ways
    const kThrottleDelayMs = 1000;


    // save might mess it up by saving a version that isn't quite up to date
    // (then it bounces that version back -- we prevent this w/ focus but 
    // we are still effectively out of sync)

    // do we need a fully custom editor to get save right? but it seems like
    // that would have conflicts w/ the text editor state

    // sync to text editor
    const applyEdit = throttle(() => {
      editor.getMarkdown(quartoWriterOptions())
        .then(code => {
          host.applyVisualEdit(code.code)
        });
    }, kThrottleDelayMs, { leading: false, trailing: true});
  

    // sync from text editor
    const receiveEdit = throttle((markdown) => {
      editor.setMarkdown(markdown, quartoWriterOptions(), false)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .then(_result => {
            //
        });
    }, kThrottleDelayMs, { leading: false, trailing: true});

    // setup communication channel for host
    visualEditorHostServer(host.vscode, {
      async init(markdown: string) {
      
        // put editor in writeable mode
        loaded = true;

        // init editor contents and sync cannonical version back to text editor
        const result = await editor.setMarkdown(markdown, quartoWriterOptions(), false);
        await host.applyVisualEdit(result.canonical);
        
        // visual editor => text editor (throttled)
        editor.subscribe(UpdateEvent, applyEdit);
  
      },

      async getMarkdown() {
        const result = await editor.getMarkdown(quartoWriterOptions());
        return result.code;
      },

      async applyTextEdit(markdown: string) {
        // only apply external edits if we don't have focus
        if (!editor.hasFocus()) {
          receiveEdit(markdown);
        } 
      }
    })

    // let the host know we are ready
    await host.editorReady();    

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