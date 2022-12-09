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

import { AttrEditInput, CalloutEditProps, CalloutEditResult, CalloutProps, PandocAttr, UIToolsAttr } from "editor-types";

import { FormikCheckbox, FormikDialog, FormikHTMLSelect, FormikTextInput, showValueEditorDialog } from "ui-widgets";

import { editAttrFields } from "./edit-attr";

import { t } from './translate';
import styles from "./styles.module.scss";


export function editCallout(attrUITools: UIToolsAttr) {
  return async (props: CalloutEditProps, removeEnabled: boolean): Promise<CalloutEditResult | null> => {
    
    const values: EditCalloutDialogValues = { 
      values: {...attrUITools.propsToInput(props.attr), ...props.callout}, 
      action: "edit" 
    };

    const result = await showValueEditorDialog(EditCalloutDialog, values, {
      removeEnabled
    });
    if (result) {
      const { id, classes, keyvalue, ...callout } = result.values;
      return {
        attr: attrUITools.inputToProps({ id, classes, keyvalue }) as PandocAttr,
        callout,
        action: result.action
      }
    } else {
      return null;
    }
  };
}



interface EditCalloutDialogValues {
  values: AttrEditInput & CalloutProps;
  action: "edit" | "remove";
}

interface EditCalloutDialogOptions {
  removeEnabled: boolean;
}

const EditCalloutDialog: React.FC<{ 
  values: EditCalloutDialogValues,
  options: EditCalloutDialogOptions,
  onClosed: (values?: EditCalloutDialogValues) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: EditCalloutDialogValues) => {
    setIsOpen(false);
    if (values) {
      props.onClosed(values);
    }
  }

  const removeButton = 
    <Button onClick={() => close({ ...props.values, action: 'remove' })}>
      {t("Unwrap Div")}
    </Button>;

  const [selectedTabId, setSelectedTabId] = useState<TabId>("callout");

  const calloutPanel = 
    <div className={styles.editCalloutPanel}>
      <ControlGroup vertical={false} fill={true}>
        <FormikHTMLSelect 
          name="type" label={t("Type")} 
          options={["note", "tip", "important", "caution", "warning"]}
        />
        <FormikHTMLSelect 
          name="appearance" label={t("Appearance")} 
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
      initialValues={props.values.values} 
      leftButtons={props.options.removeEnabled ? removeButton : undefined}
      onSubmit={(values) => close({ values, action: "edit" }) }
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