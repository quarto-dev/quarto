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

export function asYamlText(yaml: Metadata) {
  return jsYaml.dump(yaml, {
    indent: 2,
    lineWidth: -1,
    sortKeys: false,
    skipInvalid: true,
  });
}

