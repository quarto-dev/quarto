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
  CommandManagerContext, ToolbarMenuItem2, 
} from 'editor-ui';

import {
  Toolbar2,
  ToolbarButton2,
  ToolbarDivider2,
  ToolbarMenu2
} from 'editor-ui';
import { WorkbenchCommandId } from './commands';

import {
  TextBold16Filled, 
  TextBold16Regular,
  TextItalic16Filled,
  TextItalic16Regular,
  bundleIcon
} from "@fluentui/react-icons"

const TextBoldIcon = bundleIcon(TextBold16Filled, TextBold16Regular);
const TextItalicIcon = bundleIcon(TextItalic16Filled, TextItalic16Regular);

import styles from './WorkbenchToolbar.module.scss';

const CommandId = { ...EditorCommandId, ...WorkbenchCommandId };

const EditorToolbar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);

  return (
    <div className={styles.toolbar}>
      <Toolbar2>
        <ToolbarButton2 icon={<TextBoldIcon/>} title="Bold" enabled={true} active={false} onClick={() => true} />
        <ToolbarButton2 icon={<TextItalicIcon/>} title="Itatlic" enabled={true} active={false} onClick={() => true} />
        <ToolbarDivider2 />
        <ToolbarMenu2 icon={<TextBoldIcon/>} >
          <ToolbarMenuItem2 text='First' />
          <ToolbarMenuItem2 text='Second' />
        </ToolbarMenu2>
      </Toolbar2>
    </div>
  )

  /*
  return (
    <Toolbar className={styles.toolbar}>
      <CommandToolbarButton command={CommandId.Undo} />
      <CommandToolbarButton command={CommandId.Redo} />
      <ToolbarDivider />
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
      <CommandToolbarButton command={CommandId.Blockquote} />
      <ToolbarDivider />
      <WithCommand id={CommandId.TableInsertTable}>
        <ToolbarMenu icon={IconNames.TH}>
          <CommandMenuItems menu={cmState.menus.table}/>
        </ToolbarMenu>
        <ToolbarDivider />
      </WithCommand>
      <CommandToolbarButton command={CommandId.Link} />
      <CommandToolbarButton command={CommandId.Image} />
      <ToolbarDivider />
      <CommandToolbarButton command={CommandId.UserComment} />
    </Toolbar>
  );
  */
};

export default EditorToolbar;
