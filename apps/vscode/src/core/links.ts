/*
 * links.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import * as vscode from "vscode";
import { kImageExtensions } from "core";
import { Schemes } from "./schemes";

const knownSchemes = [...Object.values(Schemes), `${vscode.env.uriScheme}:`];

export function getUriForLinkWithKnownExternalScheme(
  link: string
): vscode.Uri | undefined {
  if (knownSchemes.some((knownScheme) => isOfScheme(knownScheme, link))) {
    return vscode.Uri.parse(link);
  }

  return undefined;
}

export function isOfScheme(scheme: string, link: string): boolean {
  return link.toLowerCase().startsWith(scheme);
}


export function isImageLink(link: string) {
  return kImageExtensions.some((ext) => link.toLowerCase().endsWith(ext));
}
