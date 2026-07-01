/*
 * EditorOutlineTree.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React, { useContext } from 'react';

import {
  Tree,
  TreeItem,
  TreeItemLayout,
  TreeNavigationData_unstable,
} from "@fluentui/react-components/unstable";

import { makeStyles, mergeClasses } from '@fluentui/react-components';

import { EditorOutline, EditorOutlineItem, NavigationType } from 'editor';

import { EditorOperationsContext, t } from 'editor-ui';

import styles from './EditorOutlineSidebar.module.scss';

export interface EditorOutlineTreeProps {
  outline: EditorOutline;
}

export const EditorOutlineTree: React.FC<EditorOutlineTreeProps> = props => {

  // editor operaitons context
  const editor = useContext(EditorOperationsContext);

  // get label for node
  const label = (outlineNode: EditorOutlineItem) => {
    switch (outlineNode.type) {
      case 'heading':
        return outlineNode.title;
      case 'rmd_chunk':
        return t('outline_code_chunk_text');
      case 'yaml_metadata':
        return t('outline_metadata_text');
    }
  };

  // get tree nodes from outline
  const classes = useStyles();
  const asTreeItem = (outlineNode: EditorOutlineItem) => {
    const layoutItemClass = mergeClasses(classes.itemLayout, outlineNode.children.length 
      ? classes.parentItem
      : classes.item);
    return (
      <TreeItem 
        itemType={outlineNode.children.length ? "branch" : "leaf" }
        key={outlineNode.navigation_id} 
        value={outlineNode.navigation_id}
      >
        <TreeItemLayout className={layoutItemClass}>{label(outlineNode)}</TreeItemLayout>
        {outlineNode.children.length > 0 
          ? <Tree>
              {outlineNode.children.map(asTreeItem)}
            </Tree>
          : null}
      </TreeItem>
    );
  };
  const contents = props.outline.map(asTreeItem);

  // open all by default (collect ids)
  const outlineIds = (items: EditorOutlineItem[]) => {
    return items.reduce<string[]>((previous, item) => {
      previous.push(item.navigation_id);
      previous.push(...outlineIds(item.children));
      return previous
    }, new Array<string>());
  };

  // drive editor selection from outline
  const onNavigation = (_event: React.MouseEvent | React.KeyboardEvent, data: TreeNavigationData_unstable<string>) => {
    editor.navigate(NavigationType.Id, data.value, true);
    editor.focus();
  };

  // render tree
  return (
    <div className={styles.outlineTreeContainer}>
      <Tree 
        aria-label='Outline'
        defaultOpenItems={outlineIds(props.outline)}
        className={[styles.outlineTree, 'pm-light-text-color'].join(' ')}  
        size="small"
        onNavigation_unstable={onNavigation}>
        {contents}
      </Tree>
    </div>
  );
};

const useStyles = makeStyles({
  parentItem: {
    paddingLeft: 'calc((var(--fluent-TreeItem--level, 1) - 1) * var(--spacingHorizontalS))'
  },
  item: {
    paddingLeft: 'calc((20px) + (var(--fluent-TreeItem--level, 1)) * var(--spacingHorizontalS))'
  },
  itemLayout: {
    minHeight: '22px'
  }
})

