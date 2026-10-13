/*
 * link-targets.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Tests that fragment links to Quarto's explicit identifiers (`{#id}` on
 * headings and divs) and to code cell labels are valid link targets.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CancellationToken } from "vscode-languageserver";

import { DiagnosticLevel, DiagnosticOptions } from "../src/service";
import { memoryLanguageService, qmd } from "./workspace";

const options: DiagnosticOptions = {
  enabled: true,
  validateFileLinks: DiagnosticLevel.warning,
  validateReferences: DiagnosticLevel.warning,
  validateFragmentLinks: DiagnosticLevel.warning,
  validateMarkdownFileLinkFragments: DiagnosticLevel.warning,
  validateUnusedLinkDefinitions: DiagnosticLevel.hint,
  validateDuplicateLinkDefinitions: DiagnosticLevel.warning,
  ignoreLinks: [],
};

const other = qmd("other.qmd", [
  "## Other Section {#sec-other}",
  "",
  "::: {#fig-other}",
  "A figure",
  ":::",
  "",
]);

const doc = qmd("doc.qmd", [
  "## Introduction {#sec-intro}",
  "",
  "## Methods {.unnumbered}",
  "",
  "## Results {#results}",
  "",
  "## Results",
  "",
  "::: {#fig-diagram}",
  "A diagram",
  ":::",
  "",
  "::: {.callout-note #nte-aside}",
  "An aside",
  ":::",
  "",
  "::: {#thm-main}",
  "A theorem",
  ":::",
  "",
  "```{r}",
  "#| label: fig-plot",
  "plot(1)",
  "```",
  "",
  "Headings: [a](#sec-intro), [b](#methods), [c](#results), [d](#results-1).",
  "Divs: [e](#fig-diagram), [f](#nte-aside), [g](#thm-main).",
  "Code cell: [h](#fig-plot).",
  "Other file: [i](other.qmd#sec-other), [j](other.qmd#fig-other).",
  "",
  "Not targets: [k](#introduction), [l](#fig-missing), [m](other.qmd#other-section).",
  "",
]);

test("explicit identifiers, div identifiers and code cell labels are link targets", async () => {
  const mdLs = memoryLanguageService([doc, other]);
  const diagnostics = await mdLs.computeDiagnostics(doc, options, CancellationToken.None);
  const flagged = diagnostics.map(d => doc.getText(d.range)).sort();
  // A heading with an explicit identifier doesn't also get the auto-generated
  // one (as in Pandoc), so `#introduction` and `#other-section` aren't targets.
  assert.deepEqual(flagged, ["#fig-missing", "#introduction", "#other-section"], JSON.stringify(diagnostics));
});

test("divs with identifiers are not added to the outline", async () => {
  const mdLs = memoryLanguageService([doc]);
  const symbols = await mdLs.getDocumentSymbols(doc, {}, CancellationToken.None);
  const names = (s: { name: string, children?: typeof symbols }): string[] =>
    [s.name, ...(s.children ?? []).flatMap(names)];
  assert.deepEqual(symbols.flatMap(names), ["Introduction", "Methods", "Results", "Results", "fig-plot"]);
});

test("references to a heading with an explicit identifier", async () => {
  const mdLs = memoryLanguageService([doc]);
  const text = doc.getText();
  const locations = await mdLs.getReferences(doc, { line: 0, character: 4 }, { includeDeclaration: false }, CancellationToken.None);
  // The link to `#sec-intro`, but not the one to `#introduction`
  assert.deepEqual(
    locations.map(l => doc.offsetAt(l.range.start)),
    [text.indexOf("#sec-intro)")]
  );
});

test("go to definition on a link to an explicit heading identifier", async () => {
  const mdLs = memoryLanguageService([doc]);
  const text = doc.getText();
  const position = doc.positionAt(text.indexOf("#sec-intro)") + 1);
  const definition = await mdLs.getDefinition(doc, position, CancellationToken.None);
  assert.ok(definition && !Array.isArray(definition), JSON.stringify(definition));
  assert.equal((definition as { range: { start: { line: number } } }).range.start.line, 0);
});
