/*
 * sourcepos.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorState } from "prosemirror-state";
import {  Node as ProsemirrorNode } from "prosemirror-model";

import { SourcePos, SourcePosBlock, SourcePosLocation } from "editor-types";
import { PandocTokenType } from "./pandoc";

export function getEditorSourcePos(state: EditorState): SourcePos {

  const paraBlockTypes = [
    'paragraph',
    'table_container',
    'figure',
    'line_block',
    'definition_list',
    'shortcode_block'
  ]

  const blockTypes: Record<string,SourcePosBlock> = {
    'heading': PandocTokenType.Header,
    'code_block': PandocTokenType.CodeBlock,
    'rmd_chunk': PandocTokenType.CodeBlock,
    'div': PandocTokenType.Div,
    'ordered_list': PandocTokenType.OrderedList,
    'bullet_list': PandocTokenType.BulletList,
    'raw_block': PandocTokenType.RawBlock,
    'blockquote': PandocTokenType.BlockQuote,
    'horizontal_rule': PandocTokenType.HorizontalRule
  };
    
  const locations: SourcePosLocation[] = [];
  state.doc.descendants((node: ProsemirrorNode, pos: number) => {
    if (paraBlockTypes.includes(node.type.name)) {
      locations.push({ block: PandocTokenType.Para, pos });
      return false;
    } else {
      const block = blockTypes[node.type.name];
      if (block) {
        locations.push({ block, pos});
      }
      return true;
    }
  });

  return {
    locations,
    pos: state.selection.from
  }

}
