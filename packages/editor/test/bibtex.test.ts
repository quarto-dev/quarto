/*
 * bibtex.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toBibTeX } from '../src/api/bibliography/bibDB';
import { CSL } from '../src/api/csl';

// cslTextToProsemirrorNode() parses CSL text markup with the browser's
// DOMParser. Without one, a parser that returns no document makes it fall
// back to plain text nodes, which is all these tests need.
(globalThis as { window?: unknown }).window = {
  DOMParser: class {
    parseFromString() {
      return null;
    }
  },
};

function entryType(bibtex: string | undefined) {
  return bibtex?.match(/^@(\w+)\{/)?.[1];
}

test('journal articles are exported as @article with their fields', () => {
  const csl: CSL = {
    id: 'smith2020',
    type: 'article-journal',
    title: 'Deep Learning for Cats',
    author: [{ family: 'Smith', given: 'Jane' }],
    'container-title': 'Journal of Feline Studies',
    issued: { 'date-parts': [[2020]] },
    volume: '12',
    issue: '3',
    page: '1-10',
  };
  const bibtex = toBibTeX('smith2020', csl);
  assert.equal(entryType(bibtex), 'article');
  assert.match(bibtex!, /^@article\{smith2020,$/m);
  assert.match(bibtex!, /title = \{Deep Learning for Cats\}/);
  assert.match(bibtex!, /author = \{Smith, Jane\}/);
  assert.match(bibtex!, /journal = \{Journal of Feline Studies\}/);
  assert.match(bibtex!, /year = \{2020\}/);
  assert.match(bibtex!, /number = \{3\}/);
});

test('books are exported as @book', () => {
  const csl: CSL = {
    id: 'doe2019',
    type: 'book',
    title: 'A Book',
    author: [{ family: 'Doe', given: 'John' }],
    publisher: 'Publisher',
    issued: { 'date-parts': [[2019]] },
  };
  const bibtex = toBibTeX('doe2019', csl);
  assert.equal(entryType(bibtex), 'book');
  assert.match(bibtex!, /publisher = \{Publisher\}/);
});

// bibliojson (unlike biblatex-csl-converter 2.x) has BibDB types for these
// CSL types, so they are exported as @misc rather than falling back to @article
for (const type of ['software', 'graphic', 'song', 'motion_picture', 'legislation', 'legal_case', 'personal_communication', 'interview', 'map']) {
  test(`CSL type ${type} is exported as @misc`, () => {
    const csl: CSL = {
      id: 'item',
      type,
      title: 'An Item',
      author: [{ family: 'Doe', given: 'John' }],
      issued: { 'date-parts': [[2021]] },
    };
    const bibtex = toBibTeX('item', csl);
    assert.equal(entryType(bibtex), 'misc');
    assert.match(bibtex!, /title = \{An Item\}/);
  });
}

// CSL types with no BibDB type fall back to BibTypes.misc, whose CSL type is
// 'article'. This is long-standing behavior, not something bibliojson changed.
test('unknown CSL types fall back to @article', () => {
  const csl: CSL = { id: 'x', type: 'not-a-type', title: 'X' };
  assert.equal(entryType(toBibTeX('x', csl)), 'article');
});
