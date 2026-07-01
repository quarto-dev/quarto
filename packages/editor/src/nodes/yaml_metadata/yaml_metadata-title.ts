/*
 * yaml_metadata-title.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Plugin, PluginKey, Transaction, EditorState } from 'prosemirror-state';

import { transactionsAreTypingChange, transactionsHaveChange } from '../../api/transaction';
import {
  isYamlMetadataNode,
  yamlMetadataNodes,
  kYamlMetadataTitleRegex,
  titleFromState,
} from '../../api/yaml';

const plugin = new PluginKey<string>('yaml-metadata-title');

export function yamlMetadataTitlePlugin() {
  return new Plugin<string>({
    key: plugin,
    state: {
      init(_config, state: EditorState) {
        return titleFromState(state);
      },

      apply(tr: Transaction, title: string, oldState: EditorState, newState: EditorState) {
        const transactions = [tr];

        // doc didn't change, return existing title
        if (!tr.docChanged) {
          return title;

          // non-typing change, do a full rescan
        } else if (!transactionsAreTypingChange(transactions)) {
          return titleFromState(newState);

          // change that affects a yaml metadata block, do a full rescan
        } else if (transactionsHaveChange(transactions, oldState, newState, isYamlMetadataNode)) {
          return titleFromState(newState);
        }

        // otherwise return the existing title
        else {
          return title;
        }
      },
    },
  });
}

export function getTitle(state: EditorState) {
  return plugin.getState(state);
}

export function setTitle(state: EditorState, title: string) {
  // alias schema
  const schema = state.schema;

  // no-op if yaml_metadata isn't available
  if (!schema.nodes.yaml_metadata) {
    return;
  }

  // create transaction
  const tr = state.tr;

  // escape quotes in title then build the title line
  const escapedTitle = title.replace(/"/g, `\\"`);
  const titleLine = `\ntitle: "${escapedTitle}"\n`;

  // attempt to update existing title
  const yamlNodes = yamlMetadataNodes(tr.doc);
  let foundTitle = false;
  for (const yaml of yamlNodes) {
    const titleMatch = yaml.node.textContent.match(kYamlMetadataTitleRegex);
    if (titleMatch) {
      const updatedMetadata = yaml.node.textContent.replace(kYamlMetadataTitleRegex, titleLine);
      const updatedNode = schema.nodes.yaml_metadata.createAndFill({}, schema.text(updatedMetadata));
      if (updatedNode) {
        tr.replaceRangeWith(yaml.pos, yaml.pos + yaml.node.nodeSize, updatedNode);
        foundTitle = true;
        break;
      }
    }
  }

  // if we didn't find a title then inject one at the top
  if (!foundTitle) {
    const yamlText = schema.text(`---${titleLine}---`);
    const yamlNode = schema.nodes.yaml_metadata.create({}, yamlText);
    tr.insert(1, yamlNode);
  }

  // return transaction
  return tr;
}

