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

test("loadYaml reads !expr scalars as Quarto CLI does", () => {
  assert.deepEqual(
    loadYaml("engine: knitr\nparams:\n  day: !expr Sys.Date()\n  alpha: 0.1\n"),
    { engine: "knitr", params: { day: { value: "Sys.Date()", tag: "!expr" }, alpha: 0.1 } }
  );
  assert.deepEqual(loadYaml("fig-cap: !expr \"paste('a', 'b')\"\n"), {
    "fig-cap": { value: "paste('a', 'b')", tag: "!expr" },
  });
});

test("loadYaml still throws on tags that Quarto does not know", () => {
  assert.throws(() => loadYaml("day: !r Sys.Date()\n"), /unknown/);
});

test("loadYaml reads every scalar as a string with the failsafe schema", () => {
  assert.deepEqual(loadYaml("a: 1\nb: true\nc: ~\n", { schema: "failsafe" }), { a: "1", b: "true", c: "~" });
  assert.throws(() => loadYaml("day: !expr Sys.Date()\n", { schema: "failsafe" }), /unknown/);
});

test("loadYaml reads flow collections and quoted strings continued at their key's indentation, as Quarto CLI does", () => {
  assert.deepEqual(loadYaml("categories: [\n  a,\n  b\n]\nengine: knitr\n"), { categories: ["a", "b"], engine: "knitr" });
  assert.deepEqual(loadYaml("format:\n  html: {\n    toc: true\n  }\n"), { format: { html: { toc: true } } });
  assert.deepEqual(loadYaml('title: "a\nb"\n'), { title: "a b" });
});

test("loadYaml reads the number forms that Quarto CLI does", () => {
  assert.deepEqual(
    loadYaml("n: [0b101, -0x1F, 0o17, 1_000, 1e3, .5, -.5, 017]\n"),
    { n: [5, -31, 15, 1000, 1000, 0.5, "-.5", 17] }
  );
});

test("loadYaml throws on duplicate keys, as Quarto CLI does", () => {
  assert.throws(() => loadYaml("a: 1\na: 2\n"), /duplicated mapping key/);
});

test("asYamlText writes !expr values back as tagged scalars", () => {
  const yaml = "day: !expr Sys.Date()\nalpha: 0.1\n";
  assert.equal(asYamlText(loadYaml(yaml) as Record<string, unknown>), yaml);
});

test("asYamlText quotes strings that loadYaml would read as another type", () => {
  const strings = ["yes", "true", "null", "~", "", "123", "1.5", "0b101", "-0x1F", "-0o7", "1_000", ".5", ".inf", "2024-01-15", "!expr x", "a: b", " lead", "a\nb", "---"];
  const values = { strings, asKeys: Object.fromEntries(strings.map((string) => [string, 1])) };
  assert.deepEqual(loadYaml(asYamlText(values)), values);
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
});

test("partitionCellOptions reads !expr options", () => {
  const result = partitionCellOptions("r", ['#| fig-cap: !expr paste("a")\n', "#| echo: false\n", "1\n"]);
  assert.deepEqual(result.yaml, { "fig-cap": { value: 'paste("a")', tag: "!expr" }, echo: false });
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
      // not quoted: Quarto reads a date as a string
      "date: 2024-01-15",
      "",
    ].join("\n"),
  );
});

test("asYamlText round-trips through loadYaml", () => {
  const metadata = { label: "fig-x", code: "line 1\nline 2\n", blank: "  ", n: 12 };
  assert.deepEqual(loadYaml(asYamlText(metadata)), metadata);
});
