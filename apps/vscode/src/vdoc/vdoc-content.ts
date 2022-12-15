/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Uri, workspace } from "vscode";
import { VirtualDoc } from "./vdoc";

const kQmdEmbeddedContent = "quarto-qmd-embedded-content";
const virtualDocumentContents = new Map<string, string>();

export function activateVirtualDocEmbeddedContent() {
  workspace.registerTextDocumentContentProvider(kQmdEmbeddedContent, {
    provideTextDocumentContent: (uri) => {
      const path = uri.path.slice(1);
      const originalUri = path.slice(0, path.lastIndexOf("."));
      const decodedUri = decodeURIComponent(originalUri);
      const content = virtualDocumentContents.get(decodedUri);
      return content;
    },
  });
}

export function virtualDocUriFromEmbeddedContent(
  virtualDoc: VirtualDoc,
  parentUri: Uri
) {
  // set virtual doc
  const originalUri = parentUri.toString();
  virtualDocumentContents.set(originalUri, virtualDoc.content);

  // form uri
  const vdocUriString = `${kQmdEmbeddedContent}://${
    virtualDoc.language
  }/${encodeURIComponent(originalUri)}.${virtualDoc.language.extension}`;
  const vdocUri = Uri.parse(vdocUriString);

  // return it
  return vdocUri;
}
