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

import { jsonRpcBrowserRequestTransport } from 'core-browser';

import { codeMirrorExtension } from "editor-codemirror";

import { kWriterJsonRpcPath, Prefs } from 'writer-types';

import {
  EditorContext,
  EditorDialogs,
  EditorMath,
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

import { Commands } from 'editor-ui';

export interface EditorPrefs {
  prefs: () => Prefs, 
  setPrefs: (prefs: Record<string,unknown>) => void
}

export interface EditorProviders {
  prefs: EditorPrefs
  commands: () => Commands, 
  dialogs: () => EditorDialogs,
  spelling: () => EditorUISpelling
}

export function editorContext(providers: EditorProviders) : EditorContext {
  
  const uiTools = new UITools();
  const request = jsonRpcBrowserRequestTransport(kWriterJsonRpcPath);
  const server = editorJsonRpcServer(request);
  const { math: mathServer } = editorJsonRpcServices(request);
  
  const ui = {
    dialogs: providers.dialogs(),
    display: editorDisplay(providers.commands),
    math: editorMath(mathServer),
    context: editorUIContext(),
    prefs: editorPrefs(providers.prefs),
    spelling: editorSpelling(providers.spelling),
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

function editorPrefs(provider: EditorPrefs): EditorUIPrefs {
  return {
    realtimeSpelling() : boolean {
      return provider.prefs().realtimeSpelling;
    },
    darkMode(): boolean {
      return provider.prefs().darkMode;
    },
    listSpacing(): ListSpacing {
      return provider.prefs().listSpacing;
    },
    equationPreview(): boolean {
      return provider.prefs().equationPreview;
    },
    packageListingEnabled(): boolean {
      return provider.prefs().packageListingEnabled;
    },
    tabKeyMoveFocus(): boolean {
      return provider.prefs().tabKeyMoveFocus;
    },
    emojiSkinTone(): SkinTone {
      return provider.prefs().emojiSkinTone;
    },
    setEmojiSkinTone(emojiSkinTone: SkinTone) {
      provider.setPrefs({ emojiSkinTone });
    },
    zoteroUseBetterBibtex(): boolean {
      return provider.prefs().zoteroUseBetterBibtex;
    },
    setBibliographyDefaultType(bibliographyDefaultType: string) {
      provider.setPrefs({ bibliographyDefaultType });
    },
    bibliographyDefaultType(): string {
      return provider.prefs().bibliographyDefaultType;
    },
    citationDefaultInText(): boolean {
      return provider.prefs().citationDefaultInText;
    },
    setCitationDefaultInText(citationDefaultInText: boolean) {
      provider.setPrefs({ citationDefaultInText });
    },
  };
}



function editorSpelling(provider: () => EditorUISpelling) : EditorUISpelling {
  return {
    checkWords(words: string[]): string[] {
      return provider().checkWords(words);
    },
    suggestionList(word: string, callback: (suggestions: string[]) => void) {
      return provider().suggestionList(word, callback);
    },
    isWordIgnored(word: string): boolean {
      return provider().isWordIgnored(word);
    },
    ignoreWord(word: string) {
      return provider().ignoreWord(word);
    },
    unignoreWord(word: string) {
      return provider().unignoreWord(word);
    },
    addToDictionary(word: string) {
      return provider().addToDictionary(word);
    }
  };
}
