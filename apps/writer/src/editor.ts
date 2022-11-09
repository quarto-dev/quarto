/* eslint-disable @typescript-eslint/no-unused-vars */
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

import {
  AttrEditResult,
  AttrProps,
  CalloutEditProps,
  CalloutEditResult,
  ChunkEditor,
  CodeBlockEditResult,
  CodeBlockProps,
  EditorContext,
  EditorDialogs,
  EditorDisplay,
  EditorHTMLDialogCreateFn,
  EditorHTMLDialogValidateFn,
  EditorMath,
  EditorMenuItem,
  EditorUIChunkCallbacks,
  EditorUIChunks,
  EditorUIContext,
  EditorUIPrefs,
  EditorUISpelling,
  EditorWordRange,
  ImageDimensions,
  ImageEditResult,
  ImageProps,
  InsertCiteProps,
  InsertCiteResult,
  InsertTableResult,
  InsertTabsetResult,
  kCharClassWord,
  LinkCapabilities,
  LinkEditResult,
  LinkProps,
  LinkTargets,
  ListCapabilities,
  ListEditResult,
  ListProps,
  ListSpacing,
  RawFormatProps,
  RawFormatResult,
  SkinTone,
  TableCapabilities,
  UITools,
  XRef,
} from "editor";

export async function createEditor() {
  const uiTools = new UITools();
  const server = uiTools.context.jsonRpcServer("/editor-server");

  const ui = {
    dialogs: editorDialogs(),
    display: editorDisplay(),
    math: editorMath(),
    context: editorUIContext(),
    prefs: editorPrefs(),
    chunks: editorChunks(),
    spelling: editorSpelling(),
    images: uiTools.context.defaultUIImages()
  };

  const context : EditorContext = { server, ui };
  await context.server.pandoc.getCapabilities();
}

function editorDialogs(): EditorDialogs {
  return {
    async alert(
      _message: string,
      _title: string,
      _type: number
    ): Promise<boolean> {
      return false;
    },
    async yesNoMessage(
      _message: string,
      _title: string,
      _type: number,
      _yesLabel: string,
      _noLabel: string
    ): Promise<boolean> {
      return false;
    },
    async editLink(
      _link: LinkProps,
      _targets: LinkTargets,
      _capabilities: LinkCapabilities
    ): Promise<LinkEditResult | null> {
      return null;
    },
    async editImage(
      _image: ImageProps,
      _dims: ImageDimensions | null,
      _figure: boolean,
      _editAttributes: boolean
    ): Promise<ImageEditResult | null> {
      return null;
    },
    async editCodeBlock(
      _codeBlock: CodeBlockProps,
      _attributes: boolean,
      _languages: string[]
    ): Promise<CodeBlockEditResult | null> {
      return null;
    },
    async editList(
      _list: ListProps,
      _capabilities: ListCapabilities
    ): Promise<ListEditResult | null> {
      return null;
    },
    async editAttr(
      _attr: AttrProps,
      _idHint?: string
    ): Promise<AttrEditResult | null> {
      return null;
    },
    async editSpan(
      _attr: AttrProps,
      _idHint?: string
    ): Promise<AttrEditResult | null> {
      return null;
    },
    async editDiv(
      _attr: AttrProps,
      _removeEnabled: boolean
    ): Promise<AttrEditResult | null> {
      return null;
    },
    async editCallout(
      _props: CalloutEditProps,
      _removeEnabled: boolean
    ): Promise<CalloutEditResult | null> {
      return null;
    },
    async editRawInline(
      _raw: RawFormatProps,
      _outputFormats: string[]
    ): Promise<RawFormatResult | null> {
      return null;
    },
    async editRawBlock(
      _raw: RawFormatProps,
      _outputFormats: string[]
    ): Promise<RawFormatResult | null> {
      return null;
    },
    async editMath(_id: string): Promise<string | null> {
      return null;
    },
    async insertTable(
      _capabilities: TableCapabilities
    ): Promise<InsertTableResult | null> {
      return null;
    },
    async insertTabset(): Promise<InsertTabsetResult | null> {
      return null;
    },
    async insertCite(
      _props: InsertCiteProps
    ): Promise<InsertCiteResult | null> {
      return null;
    },
    async htmlDialog(
      _title: string,
      _okText: string | null,
      _create: EditorHTMLDialogCreateFn,
      _focus: VoidFunction,
      _validate: EditorHTMLDialogValidateFn
    ): Promise<boolean> {
      return false;
    },
  };
}

function editorDisplay(): EditorDisplay {
  return {
    openURL(_url: string) {
      //
    },
    navigateToXRef(_file: string, _xref: XRef) {
      //
    },
    navigateToFile(_file: string) {
      //
    },
    async showContextMenu(
      _items: EditorMenuItem[],
      _clientX: number,
      _clientY: number
    ): Promise<boolean> {
      return false;
    },
  };
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
      return true;
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
