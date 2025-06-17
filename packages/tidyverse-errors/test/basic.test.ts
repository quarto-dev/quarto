import { test } from 'node:test';
import assert from 'node:assert';
import * as tidyverseErrors from "../src/index";

test('basic smoke tests', () => {
  console.log(tidyverseErrors.quotedStringColor("test string"));
  console.log(tidyverseErrors.tidyverseInfo("test info"));
  console.log(tidyverseErrors.tidyverseError("test error"));
});
