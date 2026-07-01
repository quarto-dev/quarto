/*
 * outline.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export interface EditorOutlineItem {
  navigation_id: string;
  type: EditorOutlineItemType;
  level: number;
  sequence: number;
  title: string;
  children: EditorOutlineItem[];
}

export const kHeadingOutlineItemType = 'heading';
export const kRmdchunkOutlineItemType = 'rmd_chunk';
export const kYamlMetadataOutlineItemType = 'yaml_metadata';

export type EditorOutlineItemType = 'heading' | 'rmd_chunk' | 'yaml_metadata';

export type EditorOutline = EditorOutlineItem[];

export interface EditingOutlineLocationItem {
  type: EditorOutlineItemType;
  level: number;
  title: string;
  active: boolean;
  position: number;
}

export interface EditingOutlineLocation {
  items: EditingOutlineLocationItem[];
}

