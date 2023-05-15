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

import { 
  FormikCheckbox, 
  FormikDialog, 
  FormikNumericInput, 
  FormikTextInput,
  showValueEditorDialog 
} from "ui-widgets";


import { InsertTableResult, TableCapabilities } from "editor-types";
import { ControlGroup, FormGroup } from "@blueprintjs/core";

import { t } from './translate';
import { fluentTheme } from "../theme";

export async function insertTable(capabilities: TableCapabilities): Promise<InsertTableResult | null> {
  const values: InsertTableResult = {
    rows: 3,
    cols: 3,
    header: true,
    caption: ''
  }
  return await showValueEditorDialog(InsertTableDialog, values, capabilities);
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
      title={t("Insert Table")} 
      theme={fluentTheme()}
      isOpen={isOpen} 
      initialValues={props.values} 
      validationSchema={yup.object().shape({
        rows: yup.number().positive(t('Please enter a number')),
        cols: yup.number().positive(t('Please enter a number')),
      })}
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      <ControlGroup fill={true}>
        <FormikNumericInput
          name="rows"
          label={t("Rows")}
          min={1}
          max={1000}
          autoFocus={true}
        />
        <FormikNumericInput
          name="cols"
          label={t("Columns")}
          min={1}
          max={1000}
        />
      </ControlGroup>

      {props.options.captions ? (
        <FormikTextInput
          name="caption"
          label={t("Caption")}
          labelInfo={t("(Optional)")}
        />
      ) : null}

      {props.options.headerOptional ? (
        <FormGroup>
          <FormikCheckbox 
            name="header"
            label={t("Include table header")}
          />
        </FormGroup>
      ) : null}
    </FormikDialog>
  )
}