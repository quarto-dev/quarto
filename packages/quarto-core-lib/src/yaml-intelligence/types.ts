/*
* types.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Schema } from "../yaml-schema/types.js";
import { MappedString } from "../text-types.js";

export type AutomationKind = "validation" | "completions";
export type PositionKind = "code-cell" | "metadata";

export interface YamlIntelligenceContext {
  code: string | MappedString;
  position: {
    row: number;
    column: number;
  };
  path: null | string;
  filetype: "yaml" | "markdown" | "script";
  embedded: boolean;
  formats: string[];
  project_formats: string[];
  engine?: string;
  line: string;

  language?: string;
  schema?: Schema;
  schemaName?: string;
  commentPrefix?: string;
  explicit?: boolean;
  client?: string;

  positionKind?: PositionKind;
}

export interface LocateFromIndentationContext {
  code: string | MappedString;
  position: {
    row: number;
    column: number;
  };
  line: string;
}
