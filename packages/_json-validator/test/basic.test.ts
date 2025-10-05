import { test } from "node:test";
import { strict as assert } from "node:assert";

import { parse } from "@quarto/annotated-json";
import { withValidator } from "../src/index";
import { Schema } from "../src/types";
import { asMappedString } from "@quarto/mapped-string";

test("parse simple YAML string", async () => {
  const yamlString = asMappedString(`
name: John Doe
age: 30
`);
  const parsed = parse(yamlString);
  const schema1: Schema = {
    "$id": "object-schema",
    "type": "object"
  };
  const schema2: Schema = {
    "$id": "number-schema",
    "type": "number"
  };

  await withValidator(schema1, async (validator) => {
    const result = await validator.validateParse(yamlString, parsed);
    assert.equal(result.errors.length, 0);
  });
  await withValidator(schema2, async (validator) => {
    const result = await validator.validateParse(yamlString, parsed);
    assert.equal(result.errors.length, 1);
  });
});
