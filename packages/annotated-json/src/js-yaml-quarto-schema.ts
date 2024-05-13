/*
 * js-yaml-quarto-schema.ts
 *
 * Copyright (C) 2024 by Posit Software, PBC
 * 
 */

import {
  _null, // this is "nil" in deno's version...? :shrug:
  bool,
  failsafe,
  float,
  int,
  Schema,
  Type,
} from "./external/js-yaml";

// Standard YAML's JSON schema + an expr tag handler ()
// http://www.yaml.org/spec/1.2/spec.html#id2803231
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const QuartoJSONSchema: any = new Schema({
  implicit: [_null, bool, int, float],
  include: [failsafe],
  explicit: [
    new Type("!expr", {
      kind: "scalar",

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      construct(data: any): Record<string, unknown> {
        const result: string = data !== null ? data : "";
        return {
          value: result,
          tag: "!expr",
        };
      },
    }),
  ],
});
