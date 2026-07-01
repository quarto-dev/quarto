/*
 * node_attr.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Node as ProsemirrorNode, NodeType, Schema } from 'prosemirror-model';

import { CommandFn } from './command';

export interface AttrEditOptions {
  type: (schema: Schema) => NodeType;
  tags?: (node: ProsemirrorNode) => string[];
  noKeyvalueTags?: boolean;
  editFn?: () => CommandFn;
  noDecorator?: boolean;
  preferHidden?: boolean;
  offset?: {
    top: number;
    right: number;
  };
}
