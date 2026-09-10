/*
 * cell-features.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { commands, LogOutputChannel, workspace } from "vscode";
import { tryAcquirePositronApi } from "@posit-dev/positron";

import { EmbeddedLanguage } from "../vdoc/languages";

/**
 * The Positron setting that turns the virtual notebook on. Contributed by
 * Positron core, not by this extension, so it is read through the full
 * configuration rather than the `quarto` section we contribute.
 */
export const kHostCellFeaturesSetting = "quarto.embeddedLanguageFeatures.native";

/**
 * Commands whose presence says this host carries the virtual notebook (see
 * {@link detectCellFeatureOwnership}).
 *
 * These are the INTERNAL ids, and the code calls the public
 * `positron.executeQuartoCell*` ones. The internal ids are what a probe can
 * see. The public ones are API commands, registered inside the extension host
 * and deliberately never mirrored into the registry that `getCommands` reads,
 * so they do not appear there at all. Neither does any
 * `vscode.executeDocumentSymbolProvider`-style command, for the same reason.
 * The internal commands are registered in the workbench, so they are visible,
 * as long as the probe does not filter underscore-prefixed ids.
 */
const kCellOwnershipCommands = [
  "_executeQuartoCellSymbolProvider",
  "_executeQuartoCellFormattingProvider",
  "_executeQuartoCellRangeFormattingProvider",
];

/**
 * Languages whose cells the host is verified to own. Matched against
 * {@link EmbeddedLanguage.ids}, so an alias of a listed language counts too.
 *
 * Add one language at a time, once its cell providers have been verified end to
 * end: a document that is not covered here keeps its virtual document, which is
 * the safe direction.
 */
const kHostOwnedLanguages = new Set(["r", "python"]);

let cellCommandsAvailable = false;

/**
 * Whether this host carries the virtual notebook.
 *
 * Capability detection is command presence rather than a Positron API flag or a
 * version comparison. Positron registers these commands unconditionally: with
 * the setting off there are no cells and they answer empty, so their presence
 * tracks "this build can own the cells" exactly. Vanilla VS Code and older
 * Positron builds have no such commands, so a user who pastes the setting key
 * into their own `settings.json` there stays on virtual documents.
 */
async function hostHasCellCommands(): Promise<boolean> {
  if (!tryAcquirePositronApi()) {
    return false;
  }

  // `false` keeps the underscore-prefixed ids we are looking for
  const all = await commands.getCommands(false);
  return kCellOwnershipCommands.every((command) => all.includes(command));
}

/**
 * Determine whether the host owns language features for code cells, and
 * record the answer where the gates can read it.
 *
 * Must be awaited during activation, before any gate can be consulted.
 */
export async function detectCellFeatureOwnership(
  outputChannel?: LogOutputChannel
): Promise<void> {
  cellCommandsAvailable = await hostHasCellCommands();

  if (cellCommandsAvailable) {
    outputChannel?.info(
      "[CellFeatures] Host owns Quarto cell language features. " +
      `The extension stands down for ${[...kHostOwnedLanguages].join(", ")} ` +
      `while ${kHostCellFeaturesSetting} is on.`
    );
  } else if (
    workspace.getConfiguration().get<boolean>(kHostCellFeaturesSetting) === true
  ) {
    outputChannel?.warn(
      `[CellFeatures] ${kHostCellFeaturesSetting} is on, but this host has no ` +
      "Quarto cell commands. Serving embedded language features from virtual " +
      "documents, which can duplicate what the host provides."
    );
  }
}

/**
 * Whether the host owns the cells of a language. Pure, so the language set
 * can be tested without an extension host.
 */
export function hostOwnsLanguage(language: EmbeddedLanguage): boolean {
  return language.ids.some((id) => kHostOwnedLanguages.has(id));
}

/**
 * Whether the host owns embedded language features for `language`, meaning
 * this extension should stand down and not serve them from a virtual document.
 *
 * Pass no language to ask about the document as a whole, which is what the
 * whole-document commands (symbols, formatting) cover.
 *
 * The setting is read live on every call so that toggling it takes effect
 * without a window reload. The statement range and help topic registrations in
 * `lsp/client.ts` follow the setting live too, via a configuration listener.
 *
 * A gated pull feature answers `undefined` rather than delegating to the Quarto
 * language server with `next()`. The server has nothing real to say about a code
 * cell: it declares the signature help, definition, and semantic tokens
 * capabilities only so that the client can intercept them with middleware, and
 * its handlers answer null (see `apps/lsp/src/middleware.ts`). For semantic
 * tokens delegating is worse than pointless, because the server's empty token
 * stream counts as an answer and would suppress the host's own provider.
 */
export function hostOwnsCellFeatures(language?: EmbeddedLanguage): boolean {
  if (!cellCommandsAvailable) {
    return false;
  }
  if (workspace.getConfiguration().get<boolean>(kHostCellFeaturesSetting) !== true) {
    return false;
  }
  return language === undefined || hostOwnsLanguage(language);
}
