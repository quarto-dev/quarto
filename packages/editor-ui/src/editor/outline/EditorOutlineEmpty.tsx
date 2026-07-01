/*
 * EditorOutlneEmpty.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React from 'react';

import { t } from 'editor-ui'

import styles from './EditorOutlineSidebar.module.scss';

export const EditorOutlineEmpty: React.FC = () => {
  return <div className={styles.outlineEmpty}>{t('outline_empty')}</div>;
};
