/*
 * mathjax.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MathjaxTypesetOptions } from 'editor-types';

import { mathjaxLoadedExtensions, mathjaxTypeset } from '../src/core/mathjax';

const options: MathjaxTypesetOptions = {
  format: 'svg',
  theme: 'light',
  scale: 1,
  extensions: [],
};

function typeset(tex: string, opts: Partial<MathjaxTypesetOptions> = {}, docText?: string) {
  const result = mathjaxTypeset(tex, { ...options, ...opts }, docText);
  assert.equal(result.error, undefined, `unexpected error typesetting ${tex}`);
  assert.ok(result.math);
  return result.math;
}

function assertSvg(svg: string) {
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  // our css is injected into the first <defs>
  assert.match(svg, /<defs><style>svg \{font-size: 100%;\} \* \{ color: #000000 \}<\/style>/);
  // glyphs are paths (fontCache: local), not text
  assert.match(svg, /<path [^>]*d="M/);
  // no errors, and no undefined macros (which noundefined renders in red)
  assert.ok(!/data-mjx-error|merror|fill="red"/.test(svg), "output has errors or undefined macros");
}

// ids are numbered per call, and MathJax 4 records the source TeX in
// data-latex, so strip them before comparing output
const normalize = (svg: string) => svg.replace(/MJX-\d+-/g, 'MJX-').replace(/ data-latex="[^"]*"/g, '');

test('typesets inline math', () => {
  assertSvg(typeset('x^2 + y^2 = z^2'));
});

test('typesets display math', () => {
  const svg = typeset(String.raw`\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}`);
  assertSvg(svg);
  assert.match(svg, /data-mml-node="mfrac"/);
  assert.match(svg, /data-mml-node="msqrt"/);
});

test('typesets environments and alternate fonts', () => {
  assertSvg(typeset(String.raw`\begin{aligned} a &= b \\ c &= \begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix} \end{aligned}`));
  assertSvg(typeset(String.raw`\mathbb{R} \mathcal{L} \mathfrak{g} \mathscr{A} \mathbf{v}`));
});

test('uses macros defined elsewhere in the document', () => {
  const docText = String.raw`Let $\newcommand{\RR}{\mathbb{R}}$ and $\newcommand{\norm}[1]{\lVert #1 \rVert}$.`;
  const svg = typeset(String.raw`\RR^n \norm{x}`, {}, docText);
  assertSvg(svg);
  assert.equal(normalize(svg), normalize(typeset(String.raw`\mathbb{R}^n \lVert x \rVert`)));
});

test('loads extensions on request', () => {
  assert.ok(!mathjaxLoadedExtensions([]).includes('mhchem'));
  assertSvg(typeset(String.raw`\ce{H2O}`, { extensions: ['mhchem'] }));
  assertSvg(typeset(String.raw`\dv{x}{t}`, { extensions: ['physics'] }));
  assertSvg(typeset(String.raw`\cancel{x}`, { extensions: ['cancel'] }));
  assert.ok(mathjaxLoadedExtensions(['mhchem']).includes('mhchem'));
});

test('every supported extension is available', () => {
  const extensions: MathjaxTypesetOptions['extensions'] = [
    'amscd', 'bbox', 'boldsymbol', 'braket', 'bussproofs', 'cancel', 'cases', 'centernot',
    'colortbl', 'empheq', 'enclose', 'extpfeil', 'gensymb', 'html', 'mathtools', 'mhchem',
    'physics', 'textcomp', 'textmacros', 'unicode', 'upgreek', 'verb',
  ];
  assertSvg(typeset(String.raw`\boldsymbol{\alpha} \bra{\psi} \upalpha \coloneqq \degree`, { extensions }));
  assert.deepEqual(
    mathjaxLoadedExtensions(extensions),
    ['ams', 'base', 'color', 'newcommand', 'noerrors', 'noundefined', ...extensions]
  );
});

test('applies the theme color and scale', () => {
  const svg = typeset('E = mc^2', { theme: 'dark', scale: 1.5 });
  assert.match(svg, /<defs><style>svg \{font-size: 150%;\} \* \{ color: #ffffff \}<\/style>/);
});

test('strips a trailing crossref label', () => {
  assert.equal(normalize(typeset('E = mc^2 $$ {#eq-einstein}')), normalize(typeset('E = mc^2')));
});

test('returns a data URI', () => {
  const result = mathjaxTypeset('x', { ...options, format: 'data-uri' });
  assert.match(result.math ?? '', /^data:image\/svg\+xml;base64,/);
  const svg = Buffer.from(result.math!.split(',')[1], 'base64').toString();
  assertSvg(svg);
});

test('escapes the source TeX in attributes', () => {
  // an unescaped `<` or `>` in an attribute makes the SVG invalid as an image
  const svg = typeset(String.raw`a < b > c \ce{A <=> B}`, { extensions: ['mhchem'] });
  assertSvg(svg);
  const attributes = svg.match(/"[^"]*"/g) ?? [];
  assert.ok(attributes.every(value => !/[<>]/.test(value)), 'unescaped < or > in an attribute');
});

test('reports TeX errors', () => {
  const result = mathjaxTypeset(String.raw`\frac{`, options);
  assert.equal(result.math, undefined);
  assert.match(result.error ?? '', /Missing close brace/);
});
