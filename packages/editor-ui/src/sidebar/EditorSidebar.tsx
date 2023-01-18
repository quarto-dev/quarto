/*
 * EditorSidebar.tsx
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

import React from "react";

import { useSelector } from 'react-redux';

import { Button, ButtonGroup } from "@blueprintjs/core";

import { editorLoading } from "../store";

import styles from './EditorSidebar.module.scss';
import { IconNames } from "@blueprintjs/icons";
import { t } from "../dialogs/translate";

export const EditorSidebar: React.FC = () => {

  const loading = useSelector(editorLoading);

  if (!loading) {
    return (
      <div className={styles.editorSidebar}>
        <ButtonGroup minimal={true} vertical={true}>
          <Button icon={IconNames.ALIGN_JUSTIFY} title={t('Show Outline')}></Button>
        </ButtonGroup>
      </div>
    );
  } else {
    return null;
  }
}
    

