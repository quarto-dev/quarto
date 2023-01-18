/*
 * EditorOutlineHeader.tsx
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

import React from 'react';


import { Icon } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import { t } from 'editor-ui';

import styles from './EditorOutlineSidebar.module.scss';

export interface EditorOutlineHeaderProps {
  onCloseClicked: () => void;
}

export const EditorOutlineHeader: React.FC<EditorOutlineHeaderProps> = props => {

  return (
    <div className={styles.outlineHeader}>
      <Icon icon={IconNames.ALIGN_JUSTIFY} className={styles.outlineHeaderToggle}  onClick={props.onCloseClicked} />
      <div className={styles.outlineHeaderText}>{t('outline_header_text')}</div>
      <Icon
        icon={IconNames.CHEVRON_LEFT}
        htmlTitle={t('close_button_title') as string}
        className={styles.outlineCloseIcon}
        onClick={props.onCloseClicked}
      />
    </div>
  );
};
