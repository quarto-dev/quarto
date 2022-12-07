/*
 * FormikFocusError.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { FormikContext } from "formik";
import React, { RefObject, useContext, useEffect } from "react";
import flatten from "flat"

export interface FormikFocusErrorProps {
  formRef: RefObject<HTMLFormElement>;
  focusDelay?: number;
}

const FormikFocusError: React.FC<FormikFocusErrorProps> = (props) => {

  const { focusDelay = 0, formRef } = props;
  const { isSubmitting, isValidating, errors } = useContext(FormikContext);

  useEffect(() => {
    const names = Object.keys(flatten(errors));
    if (names.length > 0 && isSubmitting && !isValidating && formRef.current) {
      const selector = `[data-error-key="${names[0]}"]`;
      const fallbackSelector = `[name="${names[0]}"]`;
      const inputEl = 
        (formRef.current.querySelector(selector) || 
         formRef.current.querySelector(fallbackSelector)) as HTMLElement | undefined;
      if (inputEl) {
        setTimeout(() => {
          inputEl.focus();
        }, focusDelay);
      }      
    }
  }, [isSubmitting, isValidating, errors]);

  return null;
}

export default FormikFocusError;