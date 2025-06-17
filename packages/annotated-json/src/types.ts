/*
 * types.ts
 *
 * Types for annotated-json.
 *
 * Copyright (C) 2024 by Posit Software, PBC
 *
 */

import { MappedString } from "@quarto/mapped-string";

// https://github.com/microsoft/TypeScript/issues/1897#issuecomment-822032151
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };


// AnnotatedParse annotates a JSONValue with textual spans and
// components
export interface AnnotatedParse {
  start: number;
  end: number;
  result: JSONValue;
  kind: string;
  source: MappedString;
  components: AnnotatedParse[];

  errors?: { start: number; end: number; message: string }[]; // this field is only populated at the top level
}
