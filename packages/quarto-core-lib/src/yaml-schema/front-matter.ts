/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { nullSchema as nullS } from "./constants.js";

import {
  allOfSchema as allOfS,
  anyOfSchema as anyOfS,
  completeSchema,
  describeSchema,
  enumSchema,
  objectSchema as objectS,
  regexSchema as regexS,
} from "./common.js";

import { getFormatExecuteOptionsSchema } from "./execute.js";

import { objectRefSchemaFromContextGlob, SchemaField } from "./from-yaml.js";

import { getFormatSchema } from "./format-schemas.js";

import { defineCached } from "./definitions.js";

import { errorMessageSchema } from "./common.js";
import { getYamlIntelligenceResource } from "../yaml-intelligence/resources.js";
import { fromEntries } from "../polyfills.js";
import { Schema } from "./types.js";

function pandocFormatsResource(): string[] {
  return getYamlIntelligenceResource("pandoc/formats.yml") as string[];
}

export async function makeFrontMatterFormatSchema(nonStrict = false) {
  const hideFormat = (format: string) => {
    const hideList = ["html", "epub", "docbook"];
    const hidden = hideList.some((h) =>
      format.startsWith(h) &&
      format.length > h.length
    );
    return { name: format, hidden };
  };
  const formatSchemaDescriptorList = (await pandocFormatsResource()).concat(
    "md", // alias for 'commonmark'
    "hugo", // tolerage for compatibility: initially built-in, now referrred to as 'hugo-md'
  )
    .map(
      (format) => {
        const {
          name,
          hidden,
        } = hideFormat(format);
        return {
          regex: `^(.+-)?${name}([-+].+)?$`,
          // NOTE: the following regex supports format:foo and format[foo]. It currently breaks
          // our autocompletion because it uses non-capturing groups. Since we haven't decided
          // on it, we're reverting for now.
          //
          // regex:
          //   `^${name}(?:(?:[[][^\\]\\ s]+[\\]])|(?:[:][^:+\\s]+))?(?:[+].+)?$`,
          schema: getFormatSchema(name),
          name,
          hidden,
        };
      },
    );
  const formatSchemas = formatSchemaDescriptorList.map(
    ({ regex, schema }) => ([regex, schema] as [string, Schema]),
  );
  const plusFormatStringSchemas = formatSchemaDescriptorList.map(
    ({ regex, name, hidden }) => {
      const schema = regexS(regex, `be '${name}'`);
      if (hidden) {
        return schema;
      }
      return completeSchema(schema, name);
    },
  );
  const luaFilenameS = regexS("^.+\.lua$");
  plusFormatStringSchemas.push(luaFilenameS);
  const completionsObject = fromEntries(
    formatSchemaDescriptorList
      .filter(({ hidden }) => !hidden)
      .map(({ name }) => [name, {
        type: "key",
        display: name,
        value: `${name}: `,
        description: `be '${name}'`,
        suggest_on_accept: true,
      }]),
  );

  return errorMessageSchema(
    anyOfS(
      describeSchema(
        anyOfS(...plusFormatStringSchemas),
        "the name of a pandoc-supported output format",
      ),
      objectS({
        propertyNames: luaFilenameS,
      }),
      allOfS(
        objectS({
          patternProperties: fromEntries(formatSchemas),
          completions: completionsObject,
          additionalProperties: nonStrict,
        }),
      ),
    ),
    "${value} is not a valid output format.",
  );
}

export const getFrontMatterFormatSchema = defineCached(
  async () => {
    return {
      schema: await makeFrontMatterFormatSchema(),
      errorHandlers: [],
    };
  },
  "front-matter-format",
);

export const getNonStrictFrontMatterFormatSchema = defineCached(
  async () => {
    return {
      schema: await makeFrontMatterFormatSchema(true),
      errorHandlers: [],
    };
  },
  "front-matter-format-nonstrict",
);

export const getFrontMatterSchema = defineCached(
  async () => {
    const executeObjSchema = await getFormatExecuteOptionsSchema();
    return {
      schema: anyOfS(
        nullS,
        allOfS(
          objectS({
            properties: {
              execute: executeObjSchema,
              format: (await getFrontMatterFormatSchema()),
            },
            description: "be a Quarto YAML front matter object",
          }),
          objectRefSchemaFromContextGlob(
            "document-*",
            (field: SchemaField) => field.name !== "format",
          ),
          executeObjSchema,
        ),
      ),
      errorHandlers: [],
    };
  },
  "front-matter",
);
