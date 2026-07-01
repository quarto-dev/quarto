/*
 * index.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React from "react";
import { createRoot } from "react-dom/client";

export function showValueEditorDialog<T,O = undefined>(
  dialog: React.FC<{ values: T, options: O, onClosed: (values?: T) => void}>,
  values: T,
  options: O)
:  Promise<T | null> {
  return new Promise(resolve => {
    const parent = globalThis.document.createElement("div");
    const root = createRoot(parent);
    const onClosed = (values?: T) => {
      root.unmount();
      parent.remove();
      resolve(values || null);
    }  
    root.render(React.createElement(dialog, { values, options, onClosed }));
  });
}

export { ModalDialog } from './ModalDialog';
export { ModalDialogTabList } from './ModalDialogTabList';


