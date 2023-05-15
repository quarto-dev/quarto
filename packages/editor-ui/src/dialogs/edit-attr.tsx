
/*
 * attr-edit.tsx
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

import React, { useState } from "react"
import { Button } from "@blueprintjs/core";

import { AttrEditInput, AttrEditResult, AttrProps, UIToolsAttr } from "editor-types";

import { FormikDialog, FormikTextArea, FormikTextInput, showValueEditorDialog } from "ui-widgets";

import { t } from './translate';
import { fluentTheme } from "../theme";

export interface EditAttrOptions {
  caption?: string;
  removeEnabled?: boolean;
  removeCaption?: string;
}

export function editAttr(attrUITools: UIToolsAttr, options?: EditAttrOptions) {
  return async (attr: AttrProps, idHint?: string | undefined): Promise<AttrEditResult | null> => {
    return showEditAttrDialog(attrUITools, attr, { idHint, ...options });
  }
}

export function editDiv(attrUITools: UIToolsAttr) {
  return async (attr: AttrProps, removeEnabled: boolean): Promise<AttrEditResult | null> => {
    return showEditAttrDialog(attrUITools, attr, { 
      caption: t('Div Attributes'),
      removeCaption: t('Unwrap Div'),
      removeEnabled 
    });
  }
}

export function editSpan(attrUITools: UIToolsAttr) {
  return async (attr: AttrProps): Promise<AttrEditResult | null> => {
    return showEditAttrDialog(attrUITools, attr, { 
      caption: t('Span Attributes'),
      removeEnabled: true, 
      removeCaption: t('Unwrap Span')
    });
  }
}

export function editAttrFields(autoFocus?: boolean) {
  return (
    <>
    <FormikTextInput name="id" label={t("ID")} labelInfo={t("(e.g. #overview)")} autoFocus={autoFocus} />
    <FormikTextInput name="classes" label={t("Classes")} labelInfo={t("(e.g. .illustration)")} />
    <FormikTextInput name="style" label={t("CSS styles")} labelInfo={t("(e.g. color: gray;)")} />
    <FormikTextArea name="keyvalue" label={t("Attributes")} labelInfo={t("(key=value, one per line)")} rows={3} />
    </>
  );
}

async function showEditAttrDialog(attrUITools: UIToolsAttr, attr: AttrProps, options: EditAttrDialogOptions) {
  const inputAttr = attrUITools.propsToInput(attr);
  const result = await showValueEditorDialog(EditAttrDialog, { attr: inputAttr, action: 'edit' }, options);
  if (result) {
    const editedAttr = attrUITools.inputToProps(result.attr);
    return { attr: editedAttr, action: result.action };
  } else {
    return null;
  }
}


interface EditAttrDialogValues {
  attr: AttrEditInput;
  action: "edit" | "remove"
}

interface EditAttrDialogOptions {
  caption?: string;
  idHint?: string;
  removeEnabled?: boolean;
  removeCaption?: string;
}

const EditAttrDialog: React.FC<{ 
  values: EditAttrDialogValues,
  options: EditAttrDialogOptions,
  onClosed: (values?: EditAttrDialogValues) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (attr?: AttrEditInput, action?: "edit" | "remove") => {
    action = action || "edit";
    setIsOpen(false);
    props.onClosed(attr ? { attr, action } : undefined );
  }

  const removeButton = props.options.removeEnabled ?
    <Button onClick={() => close(props.values.attr, 'remove')}>
      {props.options.removeCaption || t("Remove Attributes")}
    </Button> : undefined;

  return (
    <FormikDialog
      title={props.options.caption || t("Edit Attributes")} 
      theme={fluentTheme()}
      isOpen={isOpen} 
      initialValues={props.values.attr} 
      leftButtons={removeButton}
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      {editAttrFields(true)}
    </FormikDialog>
  )
}