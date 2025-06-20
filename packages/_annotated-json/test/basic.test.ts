import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parse } from "../src/index";

test("parse simple YAML string", () => {
  const result = parse("hello: world");
  assert.equal(result.result.hello, "world");
  assert.equal(result.start, 0);
  assert.ok(result.end > 0);
});

test("parse YAML with nested structure", () => {
  const yamlContent = `
  name: test
  config:
    debug: true
    port: 8080
  `;
  const result = parse(yamlContent);
  assert.equal(result.result.name, "test");
  assert.equal(result.result.config.debug, true);
  assert.equal(result.result.config.port, 8080);
});

test("parse YAML array", () => {
  const yamlContent = `
  items:
    - apple
    - banana
    - cherry
  `;
  const result = parse(yamlContent);
  assert.ok(Array.isArray(result.result.items));
  assert.equal(result.result.items.length, 3);
  assert.equal(result.result.items[0], "apple");
});

test("annotation contains source information", () => {
  const result = parse("test: value");
  assert.ok(result.source);
  assert.ok(result.components);
  assert.ok(result.components.length > 0);
});
