/*
 * hover.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import { Hover, MarkdownString, MarkedString, Position, SignatureHelp, commands } from "vscode";
import { adjustedPosition, unadjustedRange } from "../vdoc/vdoc";
import { EmbeddedLanguage } from "../vdoc/languages";
import { Uri } from "vscode";

export async function getHover(
  uri: Uri,
  language: EmbeddedLanguage,
  position: Position
) {
  const hovers = await commands.executeCommand<Hover[]>(
    "vscode.executeHoverProvider",
    uri,
    adjustedPosition(language, position)
  );
  if (hovers && hovers.length > 0) {
    // consolidate content
    const contents = new Array<MarkdownString | MarkedString>();
    hovers.forEach((hover) => {
      hover.contents.forEach((hoverContent) => {
        contents.push(hoverContent);
      });
    });
    // adjust range if required
    const range = hovers[0].range
      ? unadjustedRange(language, hovers[0].range)
      : undefined;
    return new Hover(contents, range);
  }
}

export async function getSignatureHelpHover(
  uri: Uri,
  language: EmbeddedLanguage,
  position: Position,
  triggerCharacter?: string
) {
  return await commands.executeCommand<SignatureHelp>(
    "vscode.executeSignatureHelpProvider",
    uri,
    adjustedPosition(language, position),
    triggerCharacter
  );
}
