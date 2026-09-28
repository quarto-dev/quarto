/*
 * package-sort.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sortPackagesByName } from '../src/behaviors/insert_citation/source_panels/insert_citation-source-panel-packages-sort';

const pkg = (name: string, version = '1.0') => ({ name, version, desc: '' });

test('packages sort case-insensitively by name', () => {
  const sorted = sortPackagesByName([pkg('zoo'), pkg('Rcpp'), pkg('dplyr'), pkg('R6'), pkg('abind')]);
  assert.deepEqual(sorted.map(p => p.name), ['abind', 'dplyr', 'R6', 'Rcpp', 'zoo']);
});

test('packages with the same name keep their original order', () => {
  const sorted = sortPackagesByName([pkg('b'), pkg('a', '2.0'), pkg('A', '1.0'), pkg('a', '3.0')]);
  assert.deepEqual(sorted.map(p => `${p.name}@${p.version}`), ['a@2.0', 'A@1.0', 'a@3.0', 'b@1.0']);
});

test('the input list is not modified', () => {
  const input = [pkg('b'), pkg('a')];
  sortPackagesByName(input);
  assert.deepEqual(input.map(p => p.name), ['b', 'a']);
});
