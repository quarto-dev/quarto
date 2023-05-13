/*
 * dialog-props.ts
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

import { DialogProps } from "@blueprintjs/core";
import { isDarkThemeActive, kDarkThemeClass } from "./theme";

export function modalDialogProps(classes: string[], style?: React.CSSProperties, themed?: boolean) : Omit<DialogProps, "isOpen"> {

  // if we have a 'root' element in dark mode then propagate to the dialog
  if (themed && isDarkThemeActive()) {
    classes = [...classes, kDarkThemeClass];
  }

  return {
    autoFocus: true,
    enforceFocus: true,
    canEscapeKeyClose: true,
    canOutsideClickClose: false,
    isCloseButtonShown: true,
    shouldReturnFocusOnClose: true,
    transitionDuration: 150,
    style: { userSelect: 'none', ...style},
    className: classes.join(' ')
  };
}
