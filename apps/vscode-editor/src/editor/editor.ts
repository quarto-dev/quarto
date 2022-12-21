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

/* Strategy for managing synchronization of edits between source and visual mode. 

This is made more complicated by the fact that getting/setting visual editor markdown 
is expensive (requires a pandoc round trip) so is throttled by 1 second. We also need
to guard against edits pinging back and forth (esp. w/ the requirement on flushing all 
pending edits on save)

We will adopt this strategy for the visual editor syncing to external changes:

1) Only accept external edits when NOT focused (once the visual editor is focused it
   is the definitive source of changes to the document)

2) These external edits are throttled by 1 second so we don't get constant (expensive) 
   refreshing of the visual editor when users type in the text editor.

3) The throttled edits are _flushed_ immediately when the visual editor gains focus
   (this ensures that it is fully up to date before it takes control of all changes)

We will adopt this strategy for the visual editor propagating its own changes:

1) The visual editor will continuously send the JSON version of the editor AST
   to the host as updates occur (this is very cheap and doesn't involve pandoc)

2) The host will apply these changes throttled by 1 second so we don't get constant
   (expensive) refreshing of the text document when users type in the visual editor

3) The throttled edits are _flushed_ immediately when the visual editor loses focus
   or when the user saves the document.

*/

import throttle from "lodash.throttle";

import { Editor, EditorFormat, EditorHooks, kQuartoDocType, UpdateEvent, FocusEvent, BlurEvent } from "editor";

import { VisualEditorHostClient, visualEditorHostServer } from "../connection";

import { editorContext } from "./context";

export function createEditor(parent: HTMLElement, host: VisualEditorHostClient) {

  // editable hook (update after we get initial payload)
  let loaded = false;
  const hooks: EditorHooks = {
    isEditable: () => loaded 
  }

  // create context
  const context = editorContext(host.server, hooks);

  Editor.create(parent, context, quartoEditorFormat()).then(async (editor) => {
    
    // sync from text editor (throttled, flushed when we get focus)
    const kThrottleDelayMs = 1000;
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
        
        // visual editor => text editor (just send the state, host will call back for markdown)
        editor.subscribe(UpdateEvent, () => host.editorUpdated(editor.getStateJson(), false));

        // when we lose focus do an update w/ flush = true
        editor.subscribe(BlurEvent, () => host.editorUpdated(editor.getStateJson(), true));

        // when we gain focus flush any received edits (they are queued just below in applyTextEdit)
        editor.subscribe(FocusEvent, () => { receiveEdit.flush(); });

        // return canonical markdown
        return result.canonical;
        
      },

      async applyTextEdit(markdown: string) {
        // only apply external text edits if we don't have focus
        if (!editor.hasFocus()) {
          receiveEdit(markdown);
        }
      },

      async getMarkdown() : Promise<string> {
        const result = await editor.getMarkdown(quartoWriterOptions());
        return result.code;
      },

      async getMarkdownFromState(state: unknown) : Promise<string> {
        return editor.getMarkdownFromStateJson(state, quartoWriterOptions());
      },
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