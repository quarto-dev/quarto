/*
 * yaml.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as yaml from "js-yaml";

import { lines } from "core";

import { Document } from "../document";

import { Parser } from "./parser";
import { isFrontMatter } from "./token";


export function parseFrontMatterStr(str: string) {
  str = str.replace(/---\s*$/, "");
  try {
    return yaml.load(str);
  } catch (error) {
    return undefined;
  }
}

const kRegExBeginYAML = /^---[ \t]*$/;
const kRegExEndYAML = /^(?:---|\.\.\.)([ \t]*)$/;

export function partitionYamlFrontMatter(
  markdown: string,
): { yaml: string; markdown: string } | null {
  // if there are are less than 3 lines or the first line isn't yaml then return null
  const mdLines = lines(markdown.trimLeft());
  if (mdLines.length < 3 || !mdLines[0].match(kRegExBeginYAML)) {
    return null;
    // if the second line is empty or has a --- then no go
  } else if (
    mdLines[1].trim().length === 0 || mdLines[1].match(kRegExEndYAML)
  ) {
    return null;
  } else {
    // if there is no end yaml position then return null
    const endYamlPos = mdLines.findIndex((line, index) =>
      index > 0 && line.match(kRegExEndYAML)
    );
    if (endYamlPos === -1) {
      return null;
    } else {
      return {
        yaml: mdLines.slice(0, endYamlPos + 1).join("\n"),
        markdown: "\n" + mdLines.slice(endYamlPos + 1).join("\n"),
      };
    }
  }
}

export function documentFrontMatter(
  parser: Parser,
  doc: Document
): Record<string, unknown> {
  const tokens = parser(doc);
  const yaml = tokens.find(isFrontMatter);
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.data);
    if (frontMatter && typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}