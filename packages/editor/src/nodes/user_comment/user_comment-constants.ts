/*
 * user_comment-constants.ts
 *
 * Copyright (C) 2019-20 by RStudio, PBC
 */

import { PluginKey } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import { NodeIndex } from "../../api/nodeindex";

export const UserCommentPluginKey = new PluginKey<DecorationSet>('user-comment');
export const UserCommentNodeCachePluginKey = new PluginKey<NodeIndex>('user-comment-node-cache');
export const UserCommentViewPluginKey = new PluginKey<NodeIndex>('user-comment-view');
