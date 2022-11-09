/*
* execute.ts
*
* Functions to compile and create the schemas for the `execute` field
* in project and frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { objectRefSchemaFromContextGlob } from "../yaml-schema/from-yaml.js";
import { idSchema, refSchema } from "../yaml-schema/common.js";
import { define } from "./definitions.js";

export function getFormatExecuteOptionsSchema() {
  const schema = idSchema(
    objectRefSchemaFromContextGlob("document-execute"),
    "front-matter-execute",
  );

  define(schema);
  return refSchema("front-matter-execute", "be a front-matter-execute object");
}
