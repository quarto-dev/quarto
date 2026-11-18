/*
 * link-headings.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Node as ProsemirrorNode, Schema } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { syncHeadingLinksAppendTransaction } from '../src/marks/link/link-headings';

// just the nodes and link attributes the sync-heading-links handler reads
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 }, link: { default: null } },
    },
    text: { group: 'inline' },
  },
  marks: {
    link: {
      attrs: { href: {}, heading: { default: null }, title: { default: null } },
      inclusive: false,
    },
  },
});

function para(...content: ProsemirrorNode[]) {
  return schema.nodes.paragraph.create(null, content);
}

function text(value: string) {
  return schema.text(value);
}

function link(value: string, attrs: { href: string; heading?: string }) {
  return schema.text(value, [schema.marks.link.create(attrs)]);
}

function heading(value: string, linkText: string | null = null) {
  return schema.nodes.heading.create({ level: 2, link: linkText }, text(value));
}

// a transaction that already carries a step growing the document before every
// link, standing in for an append handler that ran earlier in the same pass
// (e.g. figure-convert turning a linked image into a figure)
function trWithPriorStep(doc: ProsemirrorNode): Transaction {
  const tr = EditorState.create({ schema, doc }).tr;
  tr.insert(0, para(text('A paragraph inserted by an earlier append handler.')));
  return tr;
}

function linkMarks(doc: ProsemirrorNode) {
  const found: Array<{ text: string; heading: string | null }> = [];
  doc.descendants(node => {
    const mark = schema.marks.link.isInSet(node.marks);
    if (mark) {
      found.push({ text: node.text ?? '', heading: mark.attrs.heading });
    }
  });
  return found;
}

const append = syncHeadingLinksAppendTransaction().append;

test('a link at the end of the document survives steps from an earlier append handler', () => {
  const doc = schema.nodes.doc.create(null, [
    para(text('See '), link('the article', { href: 'https://example.com' })),
  ]);
  const tr = trWithPriorStep(doc);

  assert.doesNotThrow(() => append(tr));
  assert.deepEqual(linkMarks(tr.doc), [{ text: 'the article', heading: null }]);
});

test('heading links are synced with their text after steps from an earlier append handler', () => {
  const doc = schema.nodes.doc.create(null, [
    heading('Results'),
    para(text('See '), link('Results', { href: '#', heading: 'Outcomes' })),
  ]);
  const tr = trWithPriorStep(doc);

  append(tr);

  assert.deepEqual(linkMarks(tr.doc), [{ text: 'Results', heading: 'Results' }]);
});

test('links follow several renamed headings', () => {
  // both headings were renamed: rewriting the first heading's link lengthens
  // its text, which shifts the second heading's link
  const doc = schema.nodes.doc.create(null, [
    heading('Alpha Prime', 'Alpha'),
    heading('Beta Prime', 'Beta'),
    para(
      text('See '),
      link('Alpha', { href: '#', heading: 'Alpha' }),
      text(' and '),
      link('Beta', { href: '#', heading: 'Beta' }),
      text('.'),
    ),
  ]);
  const tr = EditorState.create({ schema, doc }).tr;

  append(tr);

  assert.deepEqual(linkMarks(tr.doc), [
    { text: 'Alpha Prime', heading: 'Alpha Prime' },
    { text: 'Beta Prime', heading: 'Beta Prime' },
  ]);
  assert.equal(tr.doc.lastChild?.textContent, 'See Alpha Prime and Beta Prime.');
});
