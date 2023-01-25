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
  CommandMenuItems,
  Toolbar,
  ToolbarDivider,
  ToolbarMenu,
  CommandToolbarButton,
  CommandToolbarMenu,
  WithCommand,
  t,
  editorLoaded
} from 'editor-ui';

import styles from './Editor.module.scss';

const CommandId = { ...EditorCommandId };

const EditorToolbar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);
  const loaded = useSelector(editorLoaded);

  if (loaded) {
    return (
      <Toolbar className={[styles.editorToolbar, 'pm-pane-border-color', 'pm-toolbar-background-color', 'pm-toolbar-text-color'].join(' ')}>
        <CommandToolbarMenu
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
        <ToolbarDivider />
        <CommandToolbarButton command={CommandId.Strong} />
        <CommandToolbarButton command={CommandId.Em} />
        <CommandToolbarButton command={CommandId.Code} />
        <ToolbarDivider />
        <CommandToolbarButton command={CommandId.BulletList} />
        <CommandToolbarButton command={CommandId.OrderedList} />
        <ToolbarDivider />
        <CommandToolbarButton command={CommandId.Link} />
        <CommandToolbarButton command={CommandId.Image} />
        <ToolbarDivider />
        <ToolbarMenu text={t('format_menu') as string}>
          <CommandMenuItems menu={cmState.menus.format} />
        </ToolbarMenu>
        <ToolbarDivider />
        <ToolbarMenu text={t('insert_menu') as string}>
          <CommandMenuItems menu={cmState.menus.insert} />
        </ToolbarMenu>
        <ToolbarDivider />
        <WithCommand id={CommandId.TableInsertTable}>
          <ToolbarMenu text={t('table_menu') as string}>
            <CommandMenuItems menu={cmState.menus.table} />
          </ToolbarMenu>
          <ToolbarDivider />
        </WithCommand>
       
      </Toolbar>
    );
  } else {
    return null;
  }
};

export default EditorToolbar;
