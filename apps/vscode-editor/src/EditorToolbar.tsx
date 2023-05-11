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

import { useSelector } from 'react-redux';

import { EditorCommandId } from 'editor';

import {
  CommandManagerContext,
  CommandMenuItems2,
  Toolbar2,
  ToolbarDivider2,
  CommandToolbarButton2,
  CommandToolbarMenu2,
  WithCommand,
  t,
  editorLoaded,
  Menu2
} from 'editor-ui';

import styles from './Editor.module.scss';

const CommandId = { ...EditorCommandId };

const EditorToolbar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);
  const loaded = useSelector(editorLoaded);

  if (loaded) {
    return (
      <Toolbar2 className={[styles.editorToolbar, 'pm-pane-border-color', 'pm-toolbar-background-color', 'pm-toolbar-text-color'].join(' ')}>
        <CommandToolbarMenu2
          className={styles.toolbarBlockFormatMenu}
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
        <ToolbarDivider2 />
        <CommandToolbarButton2 command={CommandId.Link} />
        <CommandToolbarButton2 command={CommandId.Image} />
        <ToolbarDivider2 />
        <Menu2 type="toolbar" text={t('format_menu') as string}>
          <CommandMenuItems2 menu={cmState.menus.format} />
        </Menu2>
        <ToolbarDivider2 />
        <Menu2 type="toolbar" text={t('insert_menu') as string}>
          <CommandMenuItems2 menu={cmState.menus.insert} />
        </Menu2>
        <ToolbarDivider2 />
        <WithCommand id={CommandId.TableInsertTable}>
          <Menu2 type="toolbar" text={t('table_menu') as string}>
            <CommandMenuItems2 menu={cmState.menus.table} />
          </Menu2>
          <ToolbarDivider2 />
        </WithCommand>
       
      </Toolbar2>
    );
  } else {
    return null;
  }
};

export default EditorToolbar;
