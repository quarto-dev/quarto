/*
 * yaml.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

// YAML is read and written with the parser and schema of Quarto CLI (a copy
// of js-yaml 4, see `loadYaml`). Imported from their files, as the package
// doesn't export them (and is a copy that is kept in sync with another, see
// packages/README.md)
import {
  FAILSAFE_SCHEMA as kCliFailsafeSchema,
  Type as CliType,
  dump as cliDump,
  loadAll as cliLoadAll,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} from "@quarto/_annotated-json/src/external/js-yaml.js";
import { QuartoJSONSchema as kCliQuartoSchema } from "@quarto/_annotated-json/src/js-yaml-quarto-schema";

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
 * The schema of Quarto CLI, in which `!expr` values are also written back as
 * scalars tagged `!expr` (the schema of the CLI only reads them).
 */
const kQuartoDumpSchema = kCliQuartoSchema.extend(
  new CliType("!expr", {
    kind: "scalar",
    construct: (source: string | null): YamlExpr => ({ value: source ?? "", tag: "!expr" }),
    predicate: isYamlExpr,
    represent: (data: YamlExpr) => data.value,
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
 * Parse a single YAML document, as Quarto CLI does: with the copy of its
 * parser (js-yaml 4) and schema that is in `@quarto/_annotated-json`. YAML
 * that renders is then YAML that is read here, with the same values. Unlike
 * the current js-yaml (5), this:
 * - reads scalars tagged `!expr` (see `YamlExpr`)
 * - reads flow collections and quoted strings that continue on lines that
 *   are indented no more than their key, as in `a: [\n  1\n]`
 * - reads numbers such as `0b101`, `-0x1F` and `1_000` as numbers
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
  const schema = options?.schema === "failsafe" ? kCliFailsafeSchema : kCliQuartoSchema;
  const docs: unknown[] = cliLoadAll(src, { schema });
  if (docs.length > 1) {
    throw new Error("expected a single document in the stream, but found more");
  }
  return docs[0];
}

/**
 * Write `yaml` as YAML that `loadYaml`, and so Quarto CLI, reads back as the
 * same values: strings are quoted when they would be read as another type.
 */
export function asYamlText(yaml: Metadata): string {
  return cliDump(yaml, {
    schema: kQuartoDumpSchema,
    indent: 2,
    lineWidth: -1,
    skipInvalid: true,
  });
}

