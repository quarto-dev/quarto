/*
 * EditorOutlineTree.tsx
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

import React, { useContext } from 'react';

import { Props, Tree, TreeNodeInfo } from '@blueprintjs/core';

import { EditorOutline, EditorOutlineItem, NavigationType } from 'editor';

import { EditorOperationsContext, t } from 'editor-ui';

import styles from './EditorOutlineSidebar.module.scss';

export interface EditorOutlineTreeProps extends Props {
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
  const asTreeNode = (outlineNode: EditorOutlineItem): TreeNodeInfo<number> => {
    return {
      id: outlineNode.navigation_id,
      label: label(outlineNode),
      hasCaret: false,
      isExpanded: true,

      childNodes: outlineNode.children.map(asTreeNode),
    };
  };
  const contents = props.outline.map(asTreeNode);

  // drive editor selection from outline
  // const dispatch = useDispatch();
  const onNodeClick = (treeNode: TreeNodeInfo<number>) => {
    editor.navigate(NavigationType.Id, treeNode.id as string, true);
    editor.focus();
  };

  // render truee
  return (
    <div className={styles.outlineTreeContainer}>
      <Tree className={[styles.outlineTree, 'pm-light-text-color'].join(' ')} contents={contents} onNodeClick={onNodeClick} />
    </div>
  );
};
