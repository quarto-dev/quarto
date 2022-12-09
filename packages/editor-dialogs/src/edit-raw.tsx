/*
 * edit-raw.tsx
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

import React, { useState } from "react";
import { Button, OptionProps } from "@blueprintjs/core";

import { RawFormatProps, RawFormatResult } from "editor-types";

import { FormikDialog, FormikHTMLSelect, FormikTextInput, showValueEditorDialog } from "ui-widgets";


import { t } from './translate';

export async function editRawInline(raw: RawFormatProps, outputFormats: string[]): Promise<RawFormatResult | null> {
  return showValueEditorDialog(EditRawDialog, { raw, action: 'edit' }, { outputFormats, editContent: true })
}

export async function editRawBlock(raw: RawFormatProps, outputFormats: string[]): Promise<RawFormatResult | null> {
  return showValueEditorDialog(EditRawDialog, { raw, action: 'edit' }, { outputFormats, editContent: false })
}

interface EditRawDialogOptions {
  outputFormats: string[];
  editContent: boolean;
}

const EditRawDialog: React.FC<{ 
  values: RawFormatResult,
  options: EditRawDialogOptions,
  onClosed: (values?: RawFormatResult) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (raw?: RawFormatProps, action?: "edit" | "remove") => {
    action = action || "edit";
    setIsOpen(false);
    props.onClosed(raw ? { raw, action } : undefined);
  }

  const removeButton = 
    <Button onClick={() => close(props.values.raw, 'remove')}>
      {t("Remove Format")}
    </Button>;

  const formats : OptionProps[] = props.options.outputFormats.map(value => ({ value }));
  if (!props.values.raw.format) {
    formats.unshift({ value: '', label: "(Choose Format)" });
  }

  return (
    <FormikDialog
      title={t("Raw Format")} 
      isOpen={isOpen} 
      initialValues={props.values.raw} 
      leftButtons={props.values.raw.format ? removeButton : undefined}
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      <FormikHTMLSelect 
        name="format" 
        label="Format" 
        options={formats}
      />
      {props.options.editContent ? 
        <FormikTextInput 
          name="content" 
          label="Content" 
          style={{fontFamily: 'monospace, monospace'}} 
        /> : null}
    </FormikDialog>
  )
}

