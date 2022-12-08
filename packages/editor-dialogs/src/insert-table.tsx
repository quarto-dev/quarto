/*
 * insert-table.tsx
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

import * as yup from "yup"

import { FormikCheckbox, FormikDialog, FormikNumericInput, FormikTextInput } from "ui-widgets";

import { showEditorDialog } from "./dialog";

import { InsertTableResult, TableCapabilities } from "editor-types";
import { ControlGroup, FormGroup } from "@blueprintjs/core";

export async function insertTable(capabilities: TableCapabilities): Promise<InsertTableResult | null> {
  const values: InsertTableResult = {
    rows: 3,
    cols: 3,
    header: true,
    caption: ''
  }
  return await showEditorDialog(InsertTableDialog, values, capabilities);
}

const InsertTableDialog: React.FC<{ 
  values: InsertTableResult,
  options: TableCapabilities,
  onClosed: (values?: InsertTableResult) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);
  const close = (values?: InsertTableResult) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  return (
    <FormikDialog
      title="Insert Table" 
      isOpen={isOpen} 
      initialValues={props.values} 
      validationSchema={yup.object().shape({
        rows: yup.number().min(1).max(1000),
        cols: yup.number().min(1).max(1000),
      })}
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      <ControlGroup fill={true}>
        <FormikNumericInput
          name="rows"
          label={"Rows"}
          min={1}
          max={1000}
          autoFocus={true}
          validated={true}
        />
        <FormikNumericInput
          name="cols"
          label={"Columns"}
          min={1}
          max={1000}
          validated={true}
        />
      </ControlGroup>

      {props.options.captions ? (
        <FormikTextInput
          name="caption"
          label={"Caption"}
          labelInfo={"(Optional)"}
        />
      ) : null}

      {props.options.headerOptional ? (
        <FormGroup>
          <FormikCheckbox 
            name="header"
            label={"Include table header"}
          />
        </FormGroup>
      ) : null}
    </FormikDialog>
  )
}