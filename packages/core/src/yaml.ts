/*
 * yaml.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as jsYaml from "js-yaml";

import { Metadata } from "./metadata";

export function removeYamlDelimiters(yaml: string) {
  return yaml
    .replace(/^---/, "")
    .replace(/---\s*$/, "");
}

/**
 * Parse a single YAML document.
 *
 * Like js-yaml's `load()`, except that empty input (empty, whitespace-only or
 * comment-only) returns `undefined` rather than throwing, as js-yaml 4 did.
 * Invalid YAML and multi-document input still throw.
 */
export function loadYaml(src: string, options?: jsYaml.LoadOptions): unknown {
  const docs = jsYaml.loadAll(src, options);
  if (docs.length > 1) {
    throw new jsYaml.YAMLException(
      "expected a single document in the stream, but found more",
    );
  }
  return docs[0];
}

export function asYamlText(yaml: Metadata) {
  return jsYaml.dump(yaml, {
    indent: 2,
    lineWidth: -1,
    skipInvalid: true,
  });
}

