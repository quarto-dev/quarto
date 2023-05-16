
/*
 * insert-tabset.tsx
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

import React, { useEffect, useRef, useState } from "react";

import { TabList, Tab, SelectTabEvent, SelectTabData, TabValue, Input, Field, makeStyles } from "@fluentui/react-components"

import { useField } from "formik";

import { AttrEditInput, InsertTabsetResult, PandocAttr, UIToolsAttr } from "editor-types";

import { FormikDialog, showValueEditorDialog } from "ui-widgets";

import { fluentTheme } from "../theme";

import { editAttrFields } from "./edit-attr";

import { t } from "./translate";

import styles from "./styles.module.scss";

export function insertTabset(attrUITools: UIToolsAttr) {
  return async (): Promise<InsertTabsetResult | null> => {
    const values = { 
      tab1: '', tab2: '', tab3: '', tab4: '', tab5: '', tab6: '', 
      ...attrUITools.propsToInput({}) 
    };
    const result = await showValueEditorDialog(InsertTabsetDialog, values, undefined);
    if (result) {
      const { tab1, tab2, tab3, tab4, tab5, tab6, ...attr } = result;
      return { 
        tabs: [tab1,tab2,tab3,tab4,tab5,tab6].filter(tab => tab.length > 0), 
        attr: attrUITools.inputToProps(attr) as PandocAttr 
      };
    } else {
      return null;
    }
  }
}

type InsertTabsetDialogValues = { 
  tab1: string;
  tab2: string;
  tab3: string;
  tab4: string;
  tab5: string;
  tab6: string;
} & AttrEditInput;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InsertTabsetDialog: React.FC<{ 
  values: InsertTabsetDialogValues,
  options: null | undefined,
  onClosed: (values?: InsertTabsetDialogValues) => void }
> = props => {

  const classes = useStyles();

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const [selectedTab, setSelectedTab] = useState<TabValue>("tabs");
  const onTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value);
  };

  const close = (values?: InsertTabsetDialogValues) => {
    setIsOpen(false);
    props.onClosed(values);  
  }

  const TabNameInput: React.FC<{tab: string, optional?: boolean, autoFocus?: boolean}> = props => {
    const [field] = useField(props.tab);

    const autoFocusRef = useRef<HTMLInputElement>(null);
    if (props.autoFocus) {
      useEffect(() => {
        setTimeout(() => {
          autoFocusRef.current?.focus();
        }, 0);
      }, []);
    }

    return (
      <Input
        type="text"
        className={classes.tabName}
        input={{ ref: autoFocusRef, autoComplete: 'off', autoFocus: props.autoFocus }}
        placeholder={props.optional ? t("(Optional)") : undefined} 
        {...field}
      />
    );
  };

  const TabsPanel = React.memo(() => 
    <div className={styles.editAttributesPanel}>
      <Field label={t("Tab names:")}>
        <TabNameInput tab="tab1" autoFocus={true} />
        <TabNameInput tab="tab2" />
        <TabNameInput tab="tab3" optional={true} />
        <TabNameInput tab="tab4" optional={true} />
        <TabNameInput tab="tab5" optional={true} />
        <TabNameInput tab="tab6" optional={true} />
      </Field>
    </div>
  );

  const AttributesPanel = React.memo(() =>
    <div className={styles.editAttributesPanel}>
      {editAttrFields()}
    </div>
  );

  return (
    <FormikDialog
      title={t("Insert Tabset")} 
      theme={fluentTheme()}
      isOpen={isOpen} 
      initialValues={props.values} 
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      <TabList
        id="insert-tabset" 
        selectedValue={selectedTab} 
        onTabSelect={onTabSelect}
      >
        <Tab id="tabs" value="tabs">{t("Tabs")}</Tab>
        <Tab id="attributes" value="attributes">{t("Attributes")}</Tab> 
      </TabList>
      <div>
        {selectedTab === "tabs" && <TabsPanel />}
        {selectedTab === "attributes" && <AttributesPanel />}
      </div>
    </FormikDialog>
  )
}

const useStyles = makeStyles({
  tabName: {
    marginBottom: '10px'
  },
})