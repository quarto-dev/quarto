/*
 * edit-math.tsx
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

import { FormikDialog, FormikTextInput } from "ui-widgets";

import { showEditorDialog } from "./dialog";

export async function editMath(id: string) : Promise<string | null> {
  const values: MathValues = { id };
  const result = await showEditorDialog(EditMathDialog, values, undefined);
  return result?.id || null;
}

interface MathValues {
  id: string;
}

const EditMathDialog: React.FC<{ 
  values: MathValues,
  onClosed: (values?: MathValues) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: MathValues) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  return (
    <FormikDialog
      title="Edit Math" 
      isOpen={isOpen} 
      initialValues={props.values} 
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
      <FormikTextInput name="id" label="Identifier" autoFocus={true} />
    </FormikDialog>
  )
}