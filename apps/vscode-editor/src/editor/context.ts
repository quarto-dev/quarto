/*
 * context.ts
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
  UITools, 
  EditorContext, 
  EditorDisplay,
  EditorUIContext, 
  EditorUIPrefs, 
  ListSpacing, 
  SkinTone, 
  XRef, 
  EditorHooks,
  EditorServer
} from "editor";

import { codeMirrorExtension } from "editor-codemirror";

import { editorDialogs } from "editor-ui";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function editorContext(server: EditorServer, hooks?: EditorHooks) {

  const uiTools = new UITools();
  const ui = {
    dialogs: editorDialogs(uiTools.attr),
    display: editorDisplay(),
    context: editorUIContext(),
    prefs: editorPrefs(),
    images: uiTools.context.defaultUIImages()
  };

  const context : EditorContext = { 
    server, 
    ui, 
    hooks,
    codeViewExtension: codeMirrorExtension 
  };

  return context;
}

function editorDisplay(): EditorDisplay {
  return  {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    openURL(_url: string) {
      //
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    navigateToXRef(_file: string, _xref: XRef) {
      //
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    navigateToFile(_file: string) {
      //
    }
  }
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      return 'tight';
    },
    equationPreview(): boolean {
      return false;
    },
    packageListingEnabled(): boolean {
      return false;
    },
    tabKeyMoveFocus(): boolean {
      return false;
    },
    emojiSkinTone(): SkinTone {
      return SkinTone.Default;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setEmojiSkinTone(_emojiSkinTone: SkinTone) {
      //
    },
    zoteroUseBetterBibtex(): boolean {
      return false;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setBibliographyDefaultType(_bibliographyDefaultType: string) {
      //
    },
    bibliographyDefaultType(): string {
      return 'bib';
    },
    citationDefaultInText(): boolean {
      return false;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setCitationDefaultInText(_citationDefaultInText: boolean) {
      //
    },
  };
}



