/*
 * edit-callout.tsx
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

import { Button, ControlGroup, FormGroup, Tab, TabId, Tabs } from "@blueprintjs/core";

import { CalloutEditProps, CalloutEditResult, CalloutProps, PandocAttr } from "editor-types";

import { FormikCheckbox, FormikDialog, FormikHTMLSelect, FormikTextInput, showValueEditorDialog } from "ui-widgets";

import { t } from './translate';
import { attrEditFields as editAttrFields } from "./edit-attr";

import styles from "./styles.module.scss";

export async function editCallout(props: CalloutEditProps, removeEnabled: boolean): Promise<CalloutEditResult | null> {
  return showValueEditorDialog(EditCalloutDialog, { attr: props.attr, callout: props.callout, action: "edit"}, {
    removeEnabled
  });
}

interface EditCalloutDialogOptions {
  removeEnabled: boolean;
}

const EditCalloutDialog: React.FC<{ 
  values: CalloutEditResult,
  options: EditCalloutDialogOptions,
  onClosed: (values?: CalloutEditResult) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: CalloutProps & PandocAttr, action?: "edit" | "remove") => {
    action = action || "edit";
    setIsOpen(false);
    if (values) {
      const { id, classes, keyvalue, ...callout } = values;
      props.onClosed({ attr: { id, classes, keyvalue }, callout, action });
    }
  }

  const removeButton = 
    <Button onClick={() => close({...props.values.callout, ...props.values.attr}, 'remove')}>
      {t("Unwrap Div")}
    </Button>;

  const [selectedTabId, setSelectedTabId] = useState<TabId>("callout");


  const calloutPanel = 
    <div className={styles.editCalloutPanel}>
      <ControlGroup vertical={false} fill={true}>
        <FormikHTMLSelect 
          name="type" label={t("Type")} fill={true} 
          options={["note", "tip", "important", "caution", "warning"]}
         />
        <FormikHTMLSelect 
          name="appearance" label={t("Apperance")} fill={true} 
          options={["default", "simple", "minimal"]} 
        />
      </ControlGroup>
      <FormikTextInput name="caption" label="Caption" labelInfo="(Optional)" />
      <FormGroup>
        <FormikCheckbox name="icon" label={t("Display icon alongside callout")}/>
      </FormGroup>
     
    </div>;

  const attributesPanel = 
    <div className={styles.editCalloutPanel}>
      {editAttrFields()}
    </div>;

  return (
    <FormikDialog
      title={t("Callout")} 
      isOpen={isOpen} 
      initialValues={{...props.values.attr, ...props.values.callout}} 
      leftButtons={props.options.removeEnabled ? removeButton : undefined}
      onSubmit={(values) => close(values, "edit") }
      onReset={() => close() }
    >
      <Tabs
        id="edit-callout" 
        selectedTabId={selectedTabId} 
        onChange={tabId => setSelectedTabId(tabId)}
        
      >
        <Tab id="callout" title={t("Callout")} panel={calloutPanel}/>
        <Tab id="attributes" title={t("Attributes")} panel={attributesPanel} /> 
      </Tabs>

    </FormikDialog>
  )
}