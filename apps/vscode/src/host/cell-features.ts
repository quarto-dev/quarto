/*
 * cell-features.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

/**
 * Who answers language feature requests inside Quarto code cells: this
 * extension, from a `.vdoc.*` temp file, or the host, from an in memory
 * virtual notebook. Both answers reach the editor for one request, so only one
 * can answer it.
 *
 * This module is the entry point for that decision, and only the decision. The
 * features stay in their own providers. Each one asks here, then stands down or
 * carries on.
 *
 * Gated per language, so a cell the host does not cover keeps its virtual
 * document:
 *
 * - completion, hover, signature help, go to definition (`lsp/client.ts`)
 * - diagnostics (`providers/diagnostics.ts`)
 *
 * Gated per document, because one request covers the whole file and only one
 * answer survives. Any cell the host owns hands it every cell, including ones
 * in languages the host does not cover:
 *
 * - document symbols (`lsp/client.ts`)
 * - document and range formatting (`providers/format.ts`)
 * - semantic tokens (`providers/semantic-tokens.ts`)
 * - statement range and help topic (`lsp/client.ts`), which are registrations,
 *   so they are disposed and registered again rather than returning early
 *
 * Not gated: `quarto.formatCell` still uses a virtual document.
 *
 * The host owns a feature when it has the cell commands (probed at activation
 * by {@link detectCellFeatureOwnership}), the setting is on, and, for a
 * per-language gate, the language is one the host advertises through
 * {@link kHostOwnedLanguagesCommand} (or `kFallbackHostOwnedLanguages` when
 * the host predates that command).
 */

import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  extensions,
  LogOutputChannel,
  workspace,
} from "vscode";
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
 * The command through which the host advertises which cell languages it serves
 * embedded language features for, right now. Takes no arguments and answers
 * lowercase language ids, e.g. `["r", "python", "sql", "ggsql"]`. The host
 * folds {@link kHostCellFeaturesSetting} and its own feature flags into the
 * answer, which can change at runtime, so it is queried again whenever the
 * configuration or the set of installed extensions changes.
 *
 * Registered unconditionally by hosts that have it, like the cell commands, so
 * its presence is probed the same way.
 */
export const kHostOwnedLanguagesCommand = "_quartoHostOwnedCellLanguages";

/**
 * Languages whose cells a host that has the cell commands but not
 * {@link kHostOwnedLanguagesCommand} owns. Those are the hosts that shipped
 * before the command existed, and these are the languages they were verified
 * to own.
 */
const kFallbackHostOwnedLanguages: ReadonlySet<string> = new Set(["r", "python"]);

/**
 * The command through which the host explains why a cell cannot be run, e.g.
 * that a `{sql}` cell in a knitr document runs at render time. Takes
 * `(documentUri: Uri, cellLanguage: string)`, shows the host's own message,
 * and answers whether it had anything to say. Called from `host/positron.ts`.
 */
export const kHostExplainUnrunnableCellCommand = "_quartoHostExplainUnrunnableCell";

let cellCommandsAvailable = false;

/**
 * The languages the host owns, cached so that the gates stay synchronous.
 * Matched against {@link EmbeddedLanguage.ids}, so an alias of a listed
 * language counts too.
 */
let hostOwnedLanguages: ReadonlySet<string> = kFallbackHostOwnedLanguages;

const kRefreshDebounceMs = 250;

/** Counts queries, so that a slow one cannot overwrite a later answer. */
let hostOwnedLanguagesQuery = 0;

const onDidChangeHostOwnedLanguagesEmitter = new EventEmitter<void>();

/**
 * Fires when the cached set of host owned languages changes, after an
 * asynchronous re-query. Consumers that cache a per-language decision (e.g.
 * diagnostics) recompute on it.
 */
export const onDidChangeHostOwnedLanguages: Event<void> =
  onDidChangeHostOwnedLanguagesEmitter.event;

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
 * Ask the host which languages it owns, or `undefined` when it has no
 * {@link kHostOwnedLanguagesCommand} (vanilla VS Code, older Positron) or the
 * command fails.
 */
async function queryHostOwnedLanguages(
  all: string[],
  outputChannel?: LogOutputChannel
): Promise<ReadonlySet<string> | undefined> {
  if (!all.includes(kHostOwnedLanguagesCommand)) {
    return undefined;
  }
  try {
    const languages = await commands.executeCommand<unknown>(kHostOwnedLanguagesCommand);
    if (!Array.isArray(languages)) {
      outputChannel?.warn(
        `[CellFeatures] ${kHostOwnedLanguagesCommand} answered ${JSON.stringify(languages)}, ` +
        `not a list, so the host is assumed to own ${[...kFallbackHostOwnedLanguages].join(", ")}.`
      );
      return undefined;
    }
    return new Set(
      languages
        .filter((language): language is string => typeof language === "string")
        .map((language) => language.toLowerCase())
    );
  } catch (err) {
    outputChannel?.warn(
      `[CellFeatures] ${kHostOwnedLanguagesCommand} failed, so the host is ` +
      `assumed to own ${[...kFallbackHostOwnedLanguages].join(", ")}: ${err}`
    );
    return undefined;
  }
}

/**
 * Query the host for the languages it owns and cache the answer, falling back
 * to {@link kFallbackHostOwnedLanguages} when it cannot say. Fires
 * {@link onDidChangeHostOwnedLanguages} when the owned languages changed.
 */
export async function refreshHostCellLanguages(
  outputChannel?: LogOutputChannel
): Promise<void> {
  const query = ++hostOwnedLanguagesQuery;
  // `false` keeps the underscore-prefixed ids we are looking for
  const all = await commands.getCommands(false);
  const languages =
    (await queryHostOwnedLanguages(all, outputChannel)) ?? kFallbackHostOwnedLanguages;
  if (query !== hostOwnedLanguagesQuery) {
    return;
  }

  const changed =
    languages.size !== hostOwnedLanguages.size ||
    [...languages].some((language) => !hostOwnedLanguages.has(language));
  hostOwnedLanguages = languages;

  if (changed) {
    if (cellCommandsAvailable) {
      outputChannel?.info(
        `[CellFeatures] Host owned cell languages: ${[...languages].join(", ") || "(none)"}.`
      );
    }
    onDidChangeHostOwnedLanguagesEmitter.fire();
  }
}

/**
 * Determine whether the host owns language features for code cells, and
 * record the answer where the gates can read it. The returned disposable stops
 * re-querying the host's cell languages (see {@link refreshHostCellLanguages})
 * when the configuration or the installed extensions change.
 *
 * Must be awaited during activation, before any gate can be consulted.
 */
export async function detectCellFeatureOwnership(
  outputChannel?: LogOutputChannel
): Promise<Disposable> {
  cellCommandsAvailable = await hostHasCellCommands();
  await refreshHostCellLanguages(outputChannel);

  // Only Positron can change its answers; elsewhere there is nothing to watch.
  if (!tryAcquirePositronApi()) {
    return Disposable.from();
  }

  // Any configuration change, not only the native setting: the host also
  // folds its own feature flags into the answer. Debounced, because settings
  // tend to change in bursts and every re-query reaches the visual editors.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void refreshHostCellLanguages(outputChannel); }, kRefreshDebounceMs);
  };
  const listeners = Disposable.from(
    workspace.onDidChangeConfiguration(refresh),
    extensions.onDidChange(refresh),
    new Disposable(() => clearTimeout(timer))
  );

  if (cellCommandsAvailable) {
    outputChannel?.info(
      "[CellFeatures] Host owns Quarto cell language features. " +
      `The extension stands down for ${[...hostOwnedLanguages].join(", ") || "no languages"} ` +
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

  return listeners;
}

/**
 * Whether the host owns the cells of a language, per the cached answer of
 * {@link kHostOwnedLanguagesCommand}. Synchronous and independent of the
 * setting and capability half of the decision, so the language set can be
 * tested without Positron.
 */
export function hostOwnsLanguage(language: EmbeddedLanguage): boolean {
  return language.ids.some((id) => hostOwnedLanguages.has(id));
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
  // A host that says it owns no language (e.g. its own feature flags are off)
  // owns no cells, so the whole-document features stay here too.
  if (hostOwnedLanguages.size === 0) {
    return false;
  }
  return language === undefined || hostOwnsLanguage(language);
}
