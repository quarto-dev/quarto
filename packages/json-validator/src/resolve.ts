/*
 * resolve.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { getSchemaDefinition } from "./schema";

import { ConcreteSchema, schemaCall } from "./types";

export function maybeResolveSchema(
  schema: ConcreteSchema,
): ConcreteSchema | true | false | undefined {
  try {
    return resolveSchema(schema);
  } catch (_e) {
    return undefined;
  }
}

export function resolveSchema(
  schema: ConcreteSchema | false | true,
  visit?: (schema: ConcreteSchema) => void,
  hasRef?: (schema: ConcreteSchema) => boolean,
  next?: (schema: ConcreteSchema) => ConcreteSchema,
): ConcreteSchema | false | true {
  if (schema === false || schema === true) {
    return schema;
  }
  if (hasRef === undefined) {
    hasRef = (cursor: ConcreteSchema) => {
      return schemaCall(cursor, {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ref: (_s) => true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      }, (_s) => false);
    };
  }
  if (!hasRef(schema)) {
    return schema;
  }
  if (visit === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    visit = (_schema: ConcreteSchema) => {};
  }
  if (next === undefined) {
    next = (cursor: ConcreteSchema) => {
      const result = schemaCall(cursor, {
        ref: (s) => getSchemaDefinition(s.$ref),
      });
      if (result === undefined) {
        throw new Error(
          "couldn't resolve schema ${JSON.stringify(cursor)}",
        );
      }
      return result;
    };
  }

  // this is on the chancy side of clever, but we're going to be extra
  // careful here and use the cycle-detecting trick. This code runs
  // in the IDE and I _really_ don't want to accidentally freeze them.
  //
  // I'm sufficiently dismayed by badly-written emacs modes that randomly
  // freeze on me from some unforeseen looping condition that I want
  // to go out of my way to avoid this for our users.

  let cursor1: ConcreteSchema = schema;
  let cursor2: ConcreteSchema = schema;
  let stopped = false;
  do {
    cursor1 = next(cursor1);
    visit(cursor1);
    // we don't early exit here. instead, we stop cursor2 and let cursor1 catch up.
    // This way, visit(cursor1) covers everything in order.
    if (hasRef(cursor2)) {
      cursor2 = next(cursor2);
    } else {
      stopped = true;
    }
    // move cursor2 twice as fast to detect cycles.
    if (hasRef(cursor2)) {
      cursor2 = next(cursor2);
    } else {
      stopped = true;
    }
    if (!stopped && cursor1 === cursor2) {
      throw new Error(`reference cycle detected at ${JSON.stringify(cursor1)}`);
    }
  } while (hasRef(cursor1));

  return cursor1;
}
