/*
 * EditorToolbar.tsx
 *
 * Copyright (C) 2019-2026 by Posit Software, PBC
 */

import React, { useContext } from 'react';

import { EditorCommandId } from 'editor';

import {
  CommandManagerContext,
  CommandMenuItems,
  Toolbar,
  ToolbarDivider,
  CommandToolbarButton,
  CommandToolbarMenu,
  WithCommand,
  t,
  editorLoaded,
  Menu,
  useEditorSelector
} from 'editor-ui';

import styles from './Editor.module.scss';

const CommandId = { ...EditorCommandId };

export interface EditorToolbarProps {
  editorId: string;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = props => {

  const [cmState] = useContext(CommandManagerContext);
  const loaded = useEditorSelector(editorLoaded, props.editorId);

  if (loaded) {
    return (
      <Toolbar className={[styles.editorToolbar, 'pm-pane-border-color', 'pm-toolbar-background-color', 'pm-toolbar-text-color'].join(' ')}>
        <CommandToolbarMenu
          minWidth={105}
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
        <Menu type="toolbar" text={t('format_menu') as string}>
          <CommandMenuItems menu={cmState.menus.format} />
        </Menu>
        <ToolbarDivider />
        <Menu type="toolbar" text={t('insert_menu') as string}>
          <CommandMenuItems menu={cmState.menus.insert} />
        </Menu>
        <WithCommand id={CommandId.TableInsertTable}>
          <ToolbarDivider />
          <Menu type="toolbar" text={t('table_menu') as string}>
            <CommandMenuItems menu={cmState.menus.table} />
          </Menu>
        </WithCommand>
       
      </Toolbar>
    );
  } else {
    return null;
  }
};
