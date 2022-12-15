/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
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

// https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types#Common_image_file_types
const kImageExtensions = [
  ".apng",
  ".bmp",
  ".gif",
  ".ico",
  ".cur",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".pjpeg",
  ".pjp",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
];

export function isImageLink(link: string) {
  return kImageExtensions.some((ext) => link.toLowerCase().endsWith(ext));
}
