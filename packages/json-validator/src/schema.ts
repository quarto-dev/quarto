/*
 * schema.ts
 *
 * JSON Schema core definitions
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import {
  AllOfSchema,
  AnyOfSchema,
  ConcreteSchema,
  Schema,
  schemaType,
} from "./types";

export function schemaAccepts(schema: Schema, testType: string): boolean {
  const t = schemaType(schema);
  if (t === testType) {
    return true;
  }
  switch (t) {
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.some((s: Schema) =>
        schemaAccepts(s, testType)
      );
    case "allOf":
      return (schema as AllOfSchema).allOf.every((s: Schema) =>
        schemaAccepts(s, testType)
      );
  }
  return false;
}

export function schemaAcceptsScalar(schema: Schema): boolean {
  const t = schemaType(schema);
  if (["object", "array"].indexOf(t) !== -1) {
    return false;
  }
  switch (t) {
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.some((s: Schema) =>
        schemaAcceptsScalar(s)
      );
    case "allOf":
      return (schema as AllOfSchema).allOf.every((s: Schema) =>
        schemaAcceptsScalar(s)
      );
  }
  return true;
}

export function schemaExhaustiveCompletions(schema: Schema): boolean {
  switch (schemaType(schema)) {
    case "false":
      return true;
    case "true":
      return true;
    case "anyOf":
      return (schema as AnyOfSchema).anyOf.every(schemaExhaustiveCompletions);
    case "allOf":
      return (schema as AllOfSchema).allOf.every(schemaExhaustiveCompletions);
    case "array":
      return true;
    case "object":
      return true;
    default:
      return (schema as ConcreteSchema).exhaustiveCompletions || false;
  }
}

const definitionsObject: Record<string, ConcreteSchema> = {};

/**
 * Check if a schema definition exists in the current definitions object.
 * @param key - The key of the schema definition to check.
 * @returns True if the schema definition exists, false otherwise.
 */
export function hasSchemaDefinition(key: string): boolean {
  return definitionsObject[key] !== undefined;
}

/**
 * Get a schema definition by its key.
 * @param key - The key of the schema definition to retrieve.
 * @returns The schema definition corresponding to the key.
 * @throws Error if the schema definition does not exist.
 */
export function getSchemaDefinition(key: string): ConcreteSchema {
  if (definitionsObject[key] === undefined) {
    throw new Error(`Schema ${key} not found.`);
  }
  return definitionsObject[key];
}

/**
 * Set a schema definition in the current definitions object.
 * @param schema - The schema definition to set.
 * @throws Error if the schema does not have a $id property.
 */
export function setSchemaDefinition(schema: ConcreteSchema) {
  if (schema.$id === undefined) {
    throw new Error(
      "setSchemaDefinition needs $id",
    );
  }
  // FIXME it's possible that without ajv we actually want to reset
  // schema definitions
  if (definitionsObject[schema.$id] === undefined) {
    definitionsObject[schema.$id] = schema;
  }
}

/**
 * Get the schema definitions object. This is a shallow copy of the current definitions.
 * @returns A copy of the schema definitions object.
 */
export function getSchemaDefinitionsObject(): Record<
  string,
  ConcreteSchema
> {
  return Object.assign({}, definitionsObject);
}

/**
 * Set the schema definitions object. This will replace the existing definitions.
 * @param newDefinitions - The new definitions to set.
 */
export function setSchemaDefinitionsObject(
  newDefinitions: Record<string, ConcreteSchema>
): void {
  Object.assign(definitionsObject, newDefinitions);
}

export function expandAliasesFrom(
  lst: string[],
  defs: Record<string, string[]>,
): string[] {
  const aliases = defs;
  const result = [];

  lst = lst.slice();
  for (let i = 0; i < lst.length; ++i) {
    const el = lst[i];
    if (el.startsWith("$")) {
      const v = aliases[el.slice(1)];
      if (v === undefined) {
        throw new Error(
          `${el} doesn't have an entry in the aliases map`,
        );
      }
      lst.push(...v);
    } else {
      result.push(el);
    }
  }
  return result;
}
