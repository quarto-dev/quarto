/*
 * edit-list.tsx
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

import { ListCapabilities, ListNumberDelim, ListNumberStyle, ListProps, ListType } from "editor-types";

import { FormikCheckbox, FormikDialog, FormikHTMLSelect, FormikNumericInput, showValueEditorDialog } from "ui-widgets";
import { FormikProps } from "formik";

import { t } from './translate';
import { fluentTheme } from "../theme";
import { Field } from "@fluentui/react-components";

export function editList(list: ListProps, capabilities: ListCapabilities): Promise<ListProps | null> {
  return showValueEditorDialog(EditListDialog, list, capabilities);
 }

const EditListDialog: React.FC<{ 
  values: ListProps,
  options: ListCapabilities,
  onClosed: (values?: ListProps) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: ListProps) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  return (
    <FormikDialog
      title={t("Ordered List")}
      theme={fluentTheme()}
      isOpen={isOpen} 
      initialValues={props.values} 
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      {(formikProps: FormikProps<ListProps>) => {
        return (<>
          <FormikHTMLSelect name="type" label={t("List type")} 
            options={Object.values(ListType)} 
          />
          <Field>
            <FormikCheckbox name="tight" label={t("Tight layout (less vertical space between items)")} />
          </Field>
          {formikProps.values.type === ListType.Ordered ?
            <>
            <FormikNumericInput name="order" label={t("Starting number")} />
            <FormikHTMLSelect name="number_style" label={t("Number style")}
              options={Object.values(ListNumberStyle).filter(
                value => props.options.example || value !== ListNumberStyle.Example,
              )}
            />
             <FormikHTMLSelect name="number_delim" label={t("Number delimiter")}
               helperText={t("Pandoc HTML output does not support custom number delimiters, so the editor will always display the period style.")}
               options={Object.values(ListNumberDelim)}
            />
            </>
            : null
          }
        </>)
      }}
     

    </FormikDialog>
  )
}