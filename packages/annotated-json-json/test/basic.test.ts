import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parse } from "../src/index";
import { asMappedString } from "@quarto/mapped-string";

test("parse simple JSON string", async () => {
  const result = await parse(asMappedString(JSON.stringify({ hello: "world" }, null, 2)));
  assert.equal((result.result as any).hello, "world");
  assert.equal(result.start, 0);
  assert.ok(result.end > 0);
});

test("parse JSON with nested structure", async () => {
  const jsonContent = `
  {
    "name": "test",
    "config": {
      "debug": true,
      "port": 8080
    }
  }
  `;

  const result = await parse(asMappedString(jsonContent));
  assert.equal((result.result as any).name, "test");
  assert.equal((result.result as any).config.debug, true);
  assert.equal((result.result as any).config.port, 8080);
});

test("parse JSON array", async () => {
  const jsonContent = `
  {
    "items": [
      "apple",
      "banana",
      "cherry"
    ]
  }
  `;
  const result = await parse(asMappedString(jsonContent));
  assert.ok(Array.isArray((result.result as any).items));
  assert.equal((result.result as any).items.length, 3);
  assert.equal((result.result as any).items[0], "apple");
});

test("annotation contains source information", async () => {
  const result = await parse(asMappedString(JSON.stringify({ test: "value" }, null, 2)));
  assert.ok(result.source);
  assert.ok(result.components);
  assert.ok(result.components.length > 0);
});
