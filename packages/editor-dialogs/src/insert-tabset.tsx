
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

import { InsertTabsetResult } from "editor-types";
import React from "react";
import { useState } from "react";
import { FormikDialog } from "ui-widgets";



export async function insertTabset(): Promise<InsertTabsetResult | null> {
  const value: InsertTabsetResult = {
    tabs: [],
    attr: {
      id: "",
      classes: [],
      keyvalue: []
    }
  };

  return value;

}



// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InsertTabsetDialog: React.FC<{ 
  values: InsertTabsetResult,
  onClosed: (values?: InsertTabsetResult) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: InsertTabsetResult) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  return (
    <FormikDialog
      title="Insert Widget" 
      isOpen={isOpen} 
      initialValues={props.values} 
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      
    </FormikDialog>
  )
}