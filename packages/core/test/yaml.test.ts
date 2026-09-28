import assert from "node:assert/strict";
import test from "node:test";

import { asYamlText, loadYaml } from "../src/yaml";
import { partitionCellOptions } from "../src/jupyter/options";

test("loadYaml returns undefined for empty, whitespace-only and comment-only input", () => {
  for (const src of ["", "  \n", "\n\n", "# just a comment\n"]) {
    assert.equal(loadYaml(src), undefined, JSON.stringify(src));
  }
});

test("loadYaml returns null for an explicit empty document", () => {
  assert.equal(loadYaml("---\n"), null);
});

test("loadYaml parses a single document", () => {
  assert.deepEqual(loadYaml("title: Hello\ntoc: true\n"), { title: "Hello", toc: true });
});

test("loadYaml throws on invalid YAML and on multiple documents", () => {
  assert.throws(() => loadYaml("a: [1, 2"));
  assert.throws(() => loadYaml("a: 1\n---\nb: 2\n"), /single document/);
});

test("loadYaml reads timestamps as strings, matching Quarto CLI", () => {
  assert.deepEqual(loadYaml("date: 2024-01-15\n"), { date: "2024-01-15" });
});

test("loadYaml does not resolve merge keys, matching Quarto CLI", () => {
  const parsed = loadYaml("base: &b {x: 1}\nd:\n  <<: *b\n  y: 2\n") as Record<string, unknown>;
  assert.deepEqual(parsed.d, { "<<": { x: 1 }, y: 2 });
});

test("partitionCellOptions parses #| options", () => {
  const result = partitionCellOptions("python", [
    "#| label: fig-x\n",
    "#| echo: false\n",
    "1 + 1\n",
  ]);
  assert.deepEqual(result.yaml, { label: "fig-x", echo: false });
  assert.equal(result.optionsSource.length, 2);
  assert.deepEqual(result.source, ["1 + 1\n"]);
  assert.equal(result.sourceStartLine, 2);
});

test("partitionCellOptions tolerates option lines with no YAML content", () => {
  for (const line of ["#|\n", "#| # a comment\n"]) {
    const result = partitionCellOptions("python", [line, "1 + 1\n"]);
    assert.equal(result.yaml, undefined, JSON.stringify(line));
    assert.deepEqual(result.source, ["1 + 1\n"]);
    assert.equal(result.sourceStartLine, 1);
  }
});

test("partitionCellOptions with no option lines", () => {
  const result = partitionCellOptions("python", ["1 + 1\n"]);
  assert.equal(result.yaml, undefined);
  assert.equal(result.sourceStartLine, 0);
});

test("partitionCellOptions throws on invalid YAML", () => {
  assert.throws(() => partitionCellOptions("python", ["#| label: [x\n", "1\n"]));
  // !expr is valid Quarto but not known to js-yaml; this is unchanged from js-yaml 4
  assert.throws(() => partitionCellOptions("r", ['#| fig-cap: !expr paste("a")\n', "1\n"]));
});

test("asYamlText dumps metadata as block YAML", () => {
  assert.equal(
    asYamlText({
      label: "fig-x",
      echo: false,
      tags: ["a", "b"],
      nested: { key: "value" },
      quoted: "a: b",
      flag: "yes",
      date: "2024-01-15",
      skipped: undefined,
    }),
    [
      "label: fig-x",
      "echo: false",
      "tags:",
      "  - a",
      "  - b",
      "nested:",
      "  key: value",
      "quoted: 'a: b'",
      "flag: 'yes'",
      "date: '2024-01-15'",
      "",
    ].join("\n"),
  );
});

test("asYamlText round-trips through loadYaml", () => {
  const metadata = { label: "fig-x", code: "line 1\nline 2\n", blank: "  ", n: 12 };
  assert.deepEqual(loadYaml(asYamlText(metadata)), metadata);
});
