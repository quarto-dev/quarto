/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * editor-context.ts
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

import {
  ChunkEditor,
  Editor,
  EditorContext,
  EditorDialogs,
  EditorDisplay,
  EditorFormat,
  EditorMath,
  EditorUIChunkCallbacks,
  EditorUIChunks,
  EditorUIContext,
  EditorUIPrefs,
  EditorUISpelling,
  EditorWordRange,
  kCharClassWord,
  ListSpacing,
  SkinTone,
  UITools,
} from "editor";



export async function createEditor(parent: HTMLElement, display: EditorDisplay, dialogs: EditorDialogs) : Promise<Editor> {
  
  const context = editorContext(display, dialogs);

  const format: EditorFormat = {
    pandocMode: 'markdown',
    pandocExtensions: '',
    rmdExtensions: {},
    hugoExtensions: {},
    docTypes: []
  }

  return Editor.create(parent, context, format, { spellCheck: true });
}

export function editorContext(display: EditorDisplay, dialogs: EditorDialogs) : EditorContext {
  
  const uiTools = new UITools();
  const ui = {
    dialogs,
    display,
    math: editorMath(),
    context: editorUIContext(),
    prefs: editorPrefs(),
    chunks: editorChunks(),
    spelling: editorSpelling(),
    images: uiTools.context.defaultUIImages()
  };

  const server = uiTools.context.jsonRpcServer("/editor-server");

  const context : EditorContext = { server, ui };

  return context;
}


function editorMath(): EditorMath {
  return {
    async typeset(
      _el: HTMLElement,
      _text: string,
      _priority: boolean
    ): Promise<boolean> {
      return false;
    },
  };
}

function editorUIContext(): EditorUIContext {
  return {
    // check if we are the active tab
    isActiveTab(): boolean {
      return true;
    },

    // get the path to the current document
    getDocumentPath(): string | null {
      return null;
    },

    // ensure the edited document is saved on the server before proceeding
    // (note this just means that the server has a copy of it for e.g.
    // indexing xrefs, from the user's standpoint the doc is still dirty)
    async withSavedDocument(): Promise<boolean> {
      return true;
    },

    // get the default directory for resources (e.g. where relative links point to)
    getDefaultResourceDir(): string {
      return "";
    },

    // map from a filesystem path to a resource reference
    mapPathToResource(path: string): string {
      return path;
    },

    // map from a resource reference (e.g. images/foo.png) to a URL we can use in the document
    mapResourceToURL(path: string): string {
      return path;
    },

    // watch a resource for changes (returns an unsubscribe function)
    watchResource(_path: string, _notify: VoidFunction): VoidFunction {
      return () => {
        /* */
      };
    },

    // translate a string
    translateText(text: string): string {
      return text;
    },

    // are there dropped uris available?
    droppedUris(): string[] | null {
      return null;
    },

    // uris from the clipboard
    async clipboardUris(): Promise<string[] | null> {
      return null;
    },

    // image from the clipboard (returned as file path)
    async clipboardImage(): Promise<string | null> {
      return null;
    },

    // resolve image uris (make relative, copy to doc local 'images' dir, etc)
    async resolveImageUris(uris: string[]): Promise<string[]> {
      return uris;
    },

    // are we running in windows desktop mode?
    isWindowsDesktop(): boolean {
      return false;
    },
  };
}

function editorPrefs(): EditorUIPrefs {
  return {
    darkMode(): boolean {
      return false;
    },
    listSpacing(): ListSpacing {
      return "tight";
    },
    equationPreview(): boolean {
      return true;
    },
    packageListingEnabled(): boolean {
      return true;
    },
    tabKeyMoveFocus(): boolean {
      return false;
    },
    emojiSkinTone(): SkinTone {
      return SkinTone.Default;
    },
    setEmojiSkinTone(_skinTone: SkinTone) {
      //
    },
    zoteroUseBetterBibtex(): boolean {
      return false;
    },
    setBibliographyDefaultType(_type: string) {
      //
    },
    bibliographyDefaultType(): string {
      return "bib";
    },
    citationDefaultInText(): boolean {
      return true;
    },
    setCitationDefaultInText(_value: boolean) {
      //
    },
  };
}

function editorChunks(): EditorUIChunks {
  return {
    // create a code chunk editor
    createChunkEditor(
      _type: string,
      _element: Element,
      _index: number,
      _classes: string[],
      _callbacks: EditorUIChunkCallbacks
    ): ChunkEditor {
      return {
        editor: null,
        setMode(_mode: string) {
          //
        },
        executeSelection() {
          //
        },
        element: document.createElement("div"),
        destroy() {
          //
        },
        setExpanded(_expanded: boolean) {
          //
        },
        getExpanded(): boolean {
          return true;
        },
      };
    },

    // expand or collapse all chunk editors
    setChunksExpanded(_expanded: boolean) {
      //
    },
  };
}

function editorSpelling() : EditorUISpelling {
  return {
    // realtime interface
    realtimeEnabled(): boolean {
      return false;
    },
    checkWords(_words: string[]): string[] {
      return [];
    },
    suggestionList(_word: string, _callback: (suggestions: string[]) => void) {
      //
    },

    // dictionary
    isWordIgnored(_word: string): boolean {
      return false;
    },
    ignoreWord(_word: string) {
      //
    },
    unignoreWord(_word: string) {
      //
    },
    addToDictionary(_word: string) {
      //
    },

    // word breaking
    breakWords(_text: string): EditorWordRange[] {
      return [];
    },
    classifyCharacter(_ch: number) {
      return kCharClassWord;
    },
  };
}
