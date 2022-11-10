/*
 * WorkbenchToolbar.tsx
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

import React from 'react';

import {
  Toolbar,
  ToolbarButton,
  ToolbarToggleButton,
  ToolbarDivider
} from '@fluentui/react-components/unstable';

import { 
  TextBold16Regular, 
  TextItalic16Regular, 
  TextUnderline16Regular, 
  AlertSnooze16Regular 
} from '@fluentui/react-icons';


export const WorkbenchToolbar: React.FunctionComponent = () => {
  return (
    <Toolbar size="small">
      <ToolbarButton
        appearance="primary"
        aria-label="Text Options - Bold"
        icon={<TextBold16Regular />}
      />
      <ToolbarButton
        aria-label="Text Options - Italic"
        icon={<TextItalic16Regular />}
      />
      <ToolbarButton
        aria-label="Text Options - Underline"
        icon={<TextUnderline16Regular />}
      />
      <ToolbarDivider />
      <ToolbarToggleButton
        aria-label="Toggle Option - Alert Snooze"
        icon={<AlertSnooze16Regular />}
        name="toggle"
        value="toggle"
      />
    </Toolbar>
  )
}
