/*
 * heading-ids.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PandocAst, PandocExtensions, PandocToken, PandocTokenType } from '../src/api/pandoc';
import { resolveHeadingIds } from '../src/pandoc/pandoc_to_prosemirror';

// resolveHeadingIds() only reads these extensions
const extensions = {
  implicit_header_references: true,
  shortcut_reference_links: true,
} as unknown as PandocExtensions;

function inlines(text: string): PandocToken[] {
  const tokens: PandocToken[] = [];
  text.split(' ').forEach((word, i) => {
    if (i > 0) {
      tokens.push({ t: PandocTokenType.Space });
    }
    tokens.push({ t: PandocTokenType.Str, c: word });
  });
  return tokens;
}

function header(text: string, id: string): PandocToken {
  return { t: PandocTokenType.Header, c: [2, [id, [], []], inlines(text)] };
}

function link(text: string, href: string): PandocToken {
  return { t: PandocTokenType.Link, c: [['', [], []], inlines(text), [href, '']] };
}

// the AST pandoc produces for this markdown (with auto_identifiers):
//
//   ## My Heading
//
//   See [My Heading] and [other text](#other).
//
//   ## Other
//
// `heading_ids` holds the ids pandoc finds with auto_identifiers disabled, so it
// has the explicit [other text](#other) link target but not the [My Heading]
// shortcut link, which only resolves via the auto-identifier.
function ast(): PandocAst {
  return {
    'pandoc-api-version': [1, 23, 1],
    meta: {},
    blocks: [
      header('My Heading', 'my-heading'),
      {
        t: PandocTokenType.Para,
        c: [
          ...inlines('See'),
          { t: PandocTokenType.Space },
          link('My Heading', '#my-heading'),
          { t: PandocTokenType.Space },
          ...inlines('and'),
          { t: PandocTokenType.Space },
          link('other text', '#other'),
        ],
      },
      header('Other', 'other'),
    ],
    heading_ids: ['#other'],
  };
}

function links(blocks: PandocToken[]) {
  const para = blocks[1].c as PandocToken[];
  return para.filter(tok => tok.t === PandocTokenType.Link).map(tok => tok.c[2][0]);
}

function headingIds(blocks: PandocToken[]) {
  return blocks.filter(tok => tok.t === PandocTokenType.Header).map(tok => tok.c[1][0]);
}

test('shortcut heading links lose their target so they can be bound to the heading', () => {
  const resolved = resolveHeadingIds(ast(), extensions);
  assert.deepEqual(links(resolved.blocks), ['#', '#other']);
});

test('heading ids are kept only when explicit or targeted by an explicit link', () => {
  const resolved = resolveHeadingIds(ast(), extensions);
  assert.deepEqual(headingIds(resolved.blocks), ['', 'other']);
  assert.equal(resolved.heading_ids, undefined);
});

test('links keep their target when shortcut heading links are not enabled', () => {
  const resolved = resolveHeadingIds(ast(), {
    implicit_header_references: true,
    shortcut_reference_links: false,
  } as unknown as PandocExtensions);
  assert.deepEqual(links(resolved.blocks), ['#my-heading', '#other']);
  assert.deepEqual(headingIds(resolved.blocks), ['my-heading', 'other']);
});
