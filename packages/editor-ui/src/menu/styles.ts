/*
 * styles.ts
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


import { makeStyles } from "@fluentui/react-components";

export const useMenuStyles = makeStyles({
  item: {
    height: '1.5em',
    paddingLeft: 0
  },
  menuButton: {
    minWidth: 'unset',
    paddingLeft: '5px',
    paddingRight: '5px',
    justifyContent: 'start'
  },
  menubarMenuButton: {
    paddingLeft: '10px',
    paddingRight: '10px'
  }
});
