/*
 * EditorContainer.tsx
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

import React, { PropsWithChildren } from 'react';

import { useEditorHotkeys } from 'editor-ui';

import styles from './Editor.module.scss';

const EditorContainer: React.FC<PropsWithChildren> = (props) => {

  const { handleKeyDown, handleKeyUp } = useEditorHotkeys();

  return (
    <div className={styles.editorParent} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      {props.children}
    </div>
  );
}


export default EditorContainer;
