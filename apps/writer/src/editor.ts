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
  CodeBlockEditResult,
  CodeBlockProps,
  EditorDialogs,
  EditorHTMLDialogCreateFn,
  EditorHTMLDialogValidateFn,
  ImageDimensions,
  ImageEditResult,
  ImageProps,
  InsertCiteProps,
  InsertCiteResult,
  InsertTableResult,
  InsertTabsetResult,
  LinkCapabilities,
  LinkEditResult,
  LinkProps,
  LinkTargets,
  ListCapabilities,
  ListEditResult,
  ListProps,
  RawFormatProps,
  RawFormatResult,
  TableCapabilities,
  UITools,
} from "editor";

export async function createEditor() {
  const uiTools = new UITools();
  const server = uiTools.server.jsonRpcServer("/editor-server");

  const ui = {
    dialogs: editorDialogs(),
  };

  const context = { server, ui };
  await context.server.pandoc.getCapabilities();
}

function editorDialogs() : EditorDialogs {
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
