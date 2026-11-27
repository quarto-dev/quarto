/*
 * yaml.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

// YAML is read and written with js-yaml 4.1.1, the version that Quarto CLI
// reads YAML with: later versions read some YAML differently (see `loadYaml`)
import * as jsYaml4 from "js-yaml-4";

import { Metadata } from "./metadata";

export function removeYamlDelimiters(yaml: string) {
  return yaml
    .replace(/^---/, "")
    .replace(/---\s*$/, "");
}

/**
 * The value of a scalar tagged `!expr` in Quarto YAML: code that an engine
 * evaluates at render, as in `date: !expr Sys.Date()`. Shaped as Quarto CLI
 * reads it.
 *
 * For example, `!expr Sys.Date()` is read as:
 *
 * ```
 * { value: "Sys.Date()", tag: "!expr" }
 * ```
 */
export interface YamlExpr {
  value: string;
  tag: "!expr";
}

export function isYamlExpr(data: unknown): data is YamlExpr {
  return typeof data === "object" && data !== null &&
    (data as YamlExpr).tag === "!expr" &&
    typeof (data as YamlExpr).value === "string";
}

/**
 * The schema that Quarto CLI reads YAML with (`QuartoJSONSchema` there): the
 * null, boolean, integer and float scalars of JSON, with everything else a
 * string, and scalars tagged `!expr`.
 *
 * It differs from the one of the CLI in that:
 * - the explicit tags `!!str`, `!!seq` and `!!map` are read, where the CLI
 *   fails on them
 * - `!expr` values are also written back as scalars tagged `!expr` (the CLI
 *   only reads them)
 */
const kQuartoSchema = jsYaml4.JSON_SCHEMA.extend(
  new jsYaml4.Type("!expr", {
    kind: "scalar",
    construct: (source: string | null): YamlExpr => ({ value: source ?? "", tag: "!expr" }),
    predicate: isYamlExpr,
    represent: (data: object) => (data as YamlExpr).value,
  })
);

export interface LoadYamlOptions {
  /**
   * Which values scalars are read as: those of Quarto (`"quarto"`, the
   * default), or all as strings (`"failsafe"`, in which `!expr` is not known).
   */
  schema?: "quarto" | "failsafe";
}

/**
 * Parse a single YAML document, as Quarto CLI does: with the same version of
 * js-yaml (4.1.1) and the same schema. YAML that renders is then YAML that is
 * read here, with the same values. Later versions of js-yaml differ:
 * - js-yaml 5 does not read flow collections and quoted strings that
 *   continue on lines that are indented no more than their key, as in
 *   `a: [\n  1\n]`
 * - js-yaml 4.3 and 5 read numbers with underscores, such as `1_000`, as
 *   strings, and js-yaml 5 also numbers such as `0b101` and `-0x1F`
 *
 * Empty input (empty, whitespace-only or comment-only) returns `undefined`.
 * Invalid YAML and multi-document input throw.
 */
export function loadYaml(src: string, options?: LoadYamlOptions): unknown {
  // the parser reads some input without content as a null document
  const isBlankOrComment = (line: string) => /^\s*(#.*)?$/.test(line);
  if (src.split(/\r?\n/).every(isBlankOrComment)) {
    return undefined;
  }
  const schema = options?.schema === "failsafe" ? jsYaml4.FAILSAFE_SCHEMA : kQuartoSchema;
  const docs = jsYaml4.loadAll(src, null, { schema });
  if (docs.length > 1) {
    throw new Error("expected a single document in the stream, but found more");
  }
  return docs[0];
}

/**
 * Write `yaml` as YAML that `loadYaml`, and so Quarto CLI, reads back as the
 * same values: strings are quoted when they would be read as another type.
 * Strings that only other versions of YAML read as another type, such as a
 * date, are not quoted.
 */
export function asYamlText(yaml: Metadata): string {
  return jsYaml4.dump(yaml, {
    schema: kQuartoSchema,
    indent: 2,
    lineWidth: -1,
    skipInvalid: true,
  });
}

