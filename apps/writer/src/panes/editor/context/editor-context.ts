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

import { PromiseQueue } from 'core';

import {
  ChunkEditor,
  EditorContext,
  EditorDialogs,
  EditorMath,
  EditorUIChunkCallbacks,
  EditorUIChunks,
  EditorUIContext,
  EditorUIPrefs,
  EditorUISpelling,
  ListSpacing,
  MathjaxTypesetResult,
  MathServer,
  SkinTone,
  UITools,
  editorJsonRpcServer,
  editorJsonRpcServices
} from "editor";
import { editorDisplay } from "./editor-display";

import { codeMirrorExtension } from "editor-codemirror";
import { kWriterJsonRpcPath } from 'writer-types';


export function editorContext(dialogs: EditorDialogs) : EditorContext {
  
  const uiTools = new UITools();
  const server = editorJsonRpcServer(kWriterJsonRpcPath);
  const services = editorJsonRpcServices(kWriterJsonRpcPath);
  
  const ui = {
    dialogs,
    display: editorDisplay(),
    math: editorMath(services.math),
    context: editorUIContext(),
    prefs: editorPrefs(),
    chunks: editorChunks(),
    spelling: editorSpelling(),
    images: uiTools.context.defaultUIImages()
  };


  const context : EditorContext = { 
    server, 
    ui, 
    codeViewExtension: codeMirrorExtension 
  };

  return context;
}


function editorMath(server: MathServer): EditorMath {

  const mathQueue = new PromiseQueue<MathjaxTypesetResult>();

  return {
    async typeset(
      el: HTMLElement,
      text: string,
      priority: boolean
    ): Promise<boolean> {

      // typeset function
      const typesetFn = () => {
        text = text.replace(/^\$\$?/, "").replace(/\$\$?$/, "");
        return server.mathjaxTypeset(text, { 
          format: "data-uri",
          theme: "light",
          scale: 1,
          extensions: []
        });
      }

      // execute immediately or enque depending on priority
      const result = priority ? await typesetFn() : await mathQueue.enqueue(typesetFn);

      // handle result
      if (result.math) {
        const img = window.document.createElement("img");
        img.src = result.math;
        el.replaceChildren(img);
        return false; // no error
      } else {
        console.log(result.error);
        return true; // error
      }
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
    realtimeSpelling() : boolean {
      return false;
    },
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
    }
  };
}
