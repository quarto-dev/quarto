/*
* descriptions.ts
*
* utility functions to help with schema descriptions
*
* Copyright (C) 2022 by RStudio, PBC
*/

import { Schema } from "../yaml-schema/types.js";
import { walkSchema } from "../yaml-validation/schema-utils.js";
import { getSchemaDefinitionsObject } from "../yaml-validation/schema.js";
import { getYamlIntelligenceResource } from "./resources.js";

// this is called in the RStudio IDE so that schemas have HTML descriptions
export function patchMarkdownDescriptions() {
  const descriptionList = getYamlIntelligenceResource(
    "schema/html-descriptions.yml",
  ) as (string | { short?: string; long?: string })[];
  const schemaList = Object.values(getSchemaDefinitionsObject());

  let cursor = 0;

  for (const schema of schemaList) {
    walkSchema(schema, (s: Schema) => {
      if (s === false || s === true) {
        return;
      }
      const description = s && s.tags && s.tags.description;
      if (!description) {
        return;
      }

      const fixedDescription = descriptionList[cursor++];
      // we directly mutate the schema here on purpose, so this will be reported by
      // RStudio IDE directly.
      if (typeof fixedDescription === "string") {
        s.documentation = fixedDescription;
      } else if (
        typeof (fixedDescription && fixedDescription.short) === "string"
      ) {
        s.documentation = fixedDescription.short;
      }
    });
  }
}
