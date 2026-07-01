/*
 * yaml_metadata-capsule.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Schema } from 'prosemirror-model';

import { ProsemirrorWriter } from '../../api/pandoc';
import { uuidv4 } from '../../api/util';
import {
  encodedBlockCapsuleRegex,
  blockCapsuleSourceWithoutPrefix,
  PandocBlockCapsule,
  blockCapsuleParagraphTokenHandler,
  blockCapsuleTextHandler,
} from '../../api/pandoc_capsule';

const kYamlBlocksRegex = /(^)(---[ \t]*\n(?![ \t]*\n)[\W\w]*?\n(?:---|\.\.\.))([ \t]*)$/gm;

const kYamlDiscardRegex = /^([\t >]*)`{3,}/m;

export function yamlMetadataBlockCapsuleFilter() {
  const kYamlMetadataCapsuleType = 'E1819605-0ACD-4FAE-8B99-9C1B7BD7C0F1'.toLowerCase();

  return {
    type: kYamlMetadataCapsuleType,

    match: kYamlBlocksRegex,

    // if there was an unterminated yaml block inside a code block (followed by more yaml,
    // perhaps in yet another code block) then the main regex eats the code block boundary.
    // provide a discard expression that excludes any yaml block that has what appears
    // to be a fenced code block boundary
    discard: kYamlDiscardRegex,

    // add a newline to ensure that if the metadata block has text right
    // below it we still end up in our own pandoc paragarph block
    enclose: (capsuleText: string) => capsuleText + '\n',
    // globally replace any instances of our block capsule found in text
    handleText: blockCapsuleTextHandler(
      kYamlMetadataCapsuleType,
      encodedBlockCapsuleRegex(undefined, '\\n', 'gm'),
      (text: string) => text.substring(0, text.length - 1), // trim off newline
    ),

    // we are looking for a paragraph token consisting entirely of a
    // block capsule of our type. if find that then return the block
    // capsule text
    handleToken: blockCapsuleParagraphTokenHandler(kYamlMetadataCapsuleType),

    // write as yaml_metadata
    writeNode: (schema: Schema, writer: ProsemirrorWriter, capsule: PandocBlockCapsule) => {
      writer.openNode(schema.nodes.yaml_metadata, {
        navigation_id: uuidv4(),
        md_index: capsule.position,
      });
      // write the lines w/o the source-level prefix
      writer.writeText(blockCapsuleSourceWithoutPrefix(capsule.source, capsule.prefix));
      writer.closeNode();
    },
  };
}
