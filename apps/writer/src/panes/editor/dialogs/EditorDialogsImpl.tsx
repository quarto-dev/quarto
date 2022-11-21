/*
 * EditorDialogs.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import React from 'react';

import { t } from '../../../i18n';

import { AlertDialogProps, AlertDialog } from '../../../widgets/dialog/AlertDialog';

import { EditorDialogEditLink, EditorDialogEditLinkProps, defaultEditLinkProps } from './EditorDialogEditLink';
import { EditorDialogEditImage, EditorDialogEditImageProps, defaultEditImageProps } from './EditorDialogEditImage';
import { EditorDialogEditAttr, EditorDialogEditAttrProps, defaultEditAttrProps } from './EditorDialogEditAttr';
import {
  EditorDialogEditList,
  defaultEditListProps,
  EditorDialogEditListProps,
} from './EditorDialogEditList';
import {
  EditorDialogInsertTable,
  EditorDialogInsertTableProps,
  defaultInsertTableProps,
} from './EditorDialogInsertTable';

import { EditorDialogEditRawProps, defaultEditRawProps, EditorDialogEditRaw } from './EditorDialogEditRaw';

import {
  LinkProps,
  LinkEditResult,
  ImageProps,
  ImageEditResult,
  ListProps,
  ListEditResult,
  AttrProps,
  AttrEditResult,
  InsertTableResult,
  ListCapabilities,
  RawFormatResult as EditRawResult,
  RawFormatProps as EditRawProps,
  LinkTargets, 
  LinkCapabilities,
  TableCapabilities,
  ImageDimensions,
  kAlertTypeInfo
} from 'editor';



export interface EditorDialogsState {
  alert: AlertDialogProps;
  editLink: EditorDialogEditLinkProps;
  editImage: EditorDialogEditImageProps;
  editAttr: EditorDialogEditAttrProps;
  editList: EditorDialogEditListProps;
  editSpan: EditorDialogEditAttrProps;
  editDiv: EditorDialogEditAttrProps;
  editRaw: EditorDialogEditRawProps;
  insertTable: EditorDialogInsertTableProps;
}

export default class EditorDialogsImpl extends React.Component<Readonly<Record<string,unknown>>, EditorDialogsState> {
  constructor(props: Readonly<Record<string,unknown>>) {
    super(props);
    this.state = {
      alert: defaultAlertProps(),
      editLink: defaultEditLinkProps(),
      editAttr: defaultEditAttrProps(),
      editImage: defaultEditImageProps(),
      editList: defaultEditListProps(),
      editSpan: defaultEditAttrProps(),
      editDiv: defaultEditAttrProps(),
      editRaw: defaultEditRawProps(),
      insertTable: defaultInsertTableProps(),
    };
  }

  public render() {
    return (
      <div>
        <AlertDialog {...this.state.alert} />
        <EditorDialogEditLink {...this.state.editLink} />
        <EditorDialogEditAttr {...this.state.editAttr} />
        <EditorDialogEditImage {...this.state.editImage} />
        <EditorDialogEditList {...this.state.editList} />
        <EditorDialogEditAttr {...this.state.editSpan} />
        <EditorDialogEditAttr {...this.state.editDiv} />
        <EditorDialogEditRaw {...this.state.editRaw} />
        <EditorDialogInsertTable {...this.state.insertTable} />
      </div>
    );
  }

  public alert(message: string, title?: string, type = kAlertTypeInfo): Promise<boolean> {
    return new Promise(resolve => {
      this.setState({
        alert: {
          isOpen: true,
          message,
          title: title || '',
          type,
          onClosed: () => {
            this.setState({ alert: { ...this.state.alert, isOpen: false } });
            resolve(true);
          },
        },
      });
    });
  }

  public editLink(
    link: LinkProps,
    targets: LinkTargets,
    capabilities: LinkCapabilities,
  ): Promise<LinkEditResult | null> {
    return new Promise(resolve => {
      this.setState({
        editLink: {
          isOpen: true,
          capabilities,
          link,
          targets,
          onClosed: (result: LinkEditResult | null) => {
            this.setState({ editLink: { ...this.state.editLink, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editImage(image: ImageProps, dims: ImageDimensions | null, editAttributes: boolean): Promise<ImageEditResult | null> {
    return new Promise(resolve => {
      this.setState({
        editImage: {
          isOpen: true,
          image,
          dims,
          editAttributes,
          onClosed: (result: ImageEditResult | null) => {
            this.setState({ editImage: { ...this.state.editImage, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editList(
    list: ListProps,
    capabilities: ListCapabilities,
  ): Promise<ListEditResult | null> {
    return new Promise(resolve => {
      this.setState({
        editList: {
          isOpen: true,
          list,
          capabilities,
          onClosed: (result: ListProps | null) => {
            this.setState({ editList: { ...this.state.editList, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editAttr(attr: AttrProps): Promise<AttrEditResult | null> {
    return new Promise(resolve => {
      this.setState({
        editAttr: {
          isOpen: true,
          attr,
          onClosed: (result: AttrEditResult | null) => {
            this.setState({ editAttr: { ...this.state.editAttr, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editSpan(attr: AttrProps): Promise<AttrEditResult | null> {
    return new Promise(resolve => {
      this.setState({
        editSpan: {
          isOpen: true,
          attr,
          removeEnabled: true,
          caption: t('edit_span_dialog_caption') as string,
          onClosed: (result: AttrEditResult | null) => {
            this.setState({ editSpan: { ...this.state.editSpan, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editDiv(attr: AttrProps, removeEnabled: boolean): Promise<AttrEditResult | null> {
    return new Promise(resolve => {
      this.setState({
        editDiv: {
          isOpen: true,
          attr,
          removeEnabled,
          caption: t('edit_div_dialog_caption') as string,
          onClosed: (result: AttrEditResult | null) => {
            this.setState({ editDiv: { ...this.state.editDiv, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editRawInline(raw: EditRawProps): Promise<EditRawResult | null> {
    return new Promise(resolve => {
      this.setState({
        editRaw: {
          isOpen: true,
          raw,
          onClosed: (result: EditRawResult | null) => {
            this.setState({ editRaw: { ...this.state.editRaw, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public editRawBlock(raw: EditRawProps): Promise<EditRawResult | null> {
    return new Promise(resolve => {
      this.setState({
        editRaw: {
          isOpen: true,
          minRows: 10,
          raw,
          onClosed: (result: EditRawResult | null) => {
            this.setState({ editRaw: { ...this.state.editRaw, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }

  public insertTable(capabilities: TableCapabilities): Promise<InsertTableResult | null> {
    return new Promise(resolve => {
      this.setState({
        insertTable: {
          isOpen: true,
          capabilities,
          onClosed: (result: InsertTableResult | null) => {
            this.setState({ insertTable: { ...this.state.insertTable, isOpen: false } });
            resolve(result);
          },
        },
      });
    });
  }
}

function defaultAlertProps(): AlertDialogProps {
  return {
    title: '',
    message: '',
    type: kAlertTypeInfo,
    isOpen: false,
    onClosed: () => {
      /* */
    },
  };
}
