/*
 * EditorToolbar.tsx
 *
 * Copyright (C) 2019-20 by RStudio, PBC
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

import React, { useContext } from 'react';

import { EditorCommandId } from 'editor';

import { 
  CommandManagerContext, 
  CommandMenuItems2, 
  Toolbar2, 
  ToolbarDivider2, 
  Menu2, 
  CommandToolbarButton2, 
  CommandToolbarMenu2,
  WithCommand 
} from 'editor-ui';

import { WorkbenchCommandId } from './commands';

import {
  Table16Filled,
  Table16Regular,
  bundleIcon
} from "@fluentui/react-icons"
const TableIcon = bundleIcon(Table16Filled, Table16Regular);

import styles from './WorkbenchToolbar.module.scss';

const CommandId = { ...EditorCommandId, ...WorkbenchCommandId };

const EditorToolbar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);

  return (
    <div className={styles.toolbar}>
      <Toolbar2>
        <CommandToolbarButton2 command={CommandId.Undo} />
        <CommandToolbarButton2 command={CommandId.Redo} />
        <ToolbarDivider2 />
        <CommandToolbarMenu2
          minWidth={115}
          commands={[
            CommandId.Paragraph,
            '---',
            CommandId.Heading1,
            CommandId.Heading2,
            CommandId.Heading3,
            CommandId.Heading4,
            CommandId.Heading5,
            CommandId.Heading6,
            '---',
            CommandId.CodeBlock,
          ]}
        />
        <ToolbarDivider2 />
        <CommandToolbarButton2 command={CommandId.Strong} />
        <CommandToolbarButton2 command={CommandId.Em} />
        <CommandToolbarButton2 command={CommandId.Code} />
        <ToolbarDivider2 />
        <CommandToolbarButton2 command={CommandId.BulletList} />
        <CommandToolbarButton2 command={CommandId.OrderedList} />
        <CommandToolbarButton2 command={CommandId.Blockquote} />
        <ToolbarDivider2 />
        <WithCommand id={CommandId.TableInsertTable}>
          <Menu2 type="toolbar" icon={<TableIcon />}>
            <CommandMenuItems2 menu={cmState.menus.table}/>
          </Menu2>
          <ToolbarDivider2 />
        </WithCommand>
        <CommandToolbarButton2 command={CommandId.Link} />
        <CommandToolbarButton2 command={CommandId.Image} />
      </Toolbar2>
    </div>
   
  );
};

export default EditorToolbar;
