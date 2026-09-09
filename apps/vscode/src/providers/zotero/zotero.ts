/*
 * zotero.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 */

import { ExtensionContext, LogOutputChannel, ProgressLocation, commands, window, workspace, Uri } from "vscode";
import { zoteroApi, zoteroSyncWebLibraries, zoteroValidateApiKey } from "editor-server";

import { Command } from "../../core/command";
import { QuartoLspClient } from "../../lsp/client";
import { editorZoteroJsonRpcServer } from "editor-core";
import { ZoteroCollectionSpec, ZoteroLibraryConfig, ZoteroResult, ZoteroServer, kZoteroMyLibrary } from "editor-types";
import { zoteroServerMethods } from "editor-server/src/server/zotero";
import { JsonRpcRequestTransport, sleep } from "core";

const kQuartoZoteroWebApiKey = "quartoZoteroWebApiKey";

const kZoteroConfigureLibrary = "quarto.zoteroConfigureLibrary";
const kZoteroSyncWebLibrary = "quarto.zoteroSyncWebLibrary";
const kZoteroUnauthorized = "quarto.zoteroUnauthorized";

// Resolves once the initial Zotero library configuration has been pushed to the
// (lazily started) LSP server. Zotero data requests await this so that the
// backend knows which library is configured before it answers; otherwise, with
// lazy startup, a request that triggered startup could reach the server before
// `setLibraryConfig` and get back empty results. Assigned by `activateZotero`;
// defaults to a no-op so `zoteroLspProxy` is safe if Zotero was never activated.
let ensureZoteroConfigSynced: () => Promise<void> = () => Promise.resolve();

export async function activateZotero(context: ExtensionContext, lsp: QuartoLspClient, outputChannel: LogOutputChannel): Promise<Command[]> {

  // establish zotero connection (lazy: does not force the LSP to start)
  const zotero = editorZoteroJsonRpcServer(lsp.lspRequest);

  // sync quarto config to the back end (whenever the LSP server is running);
  // exposes the gate that Zotero data requests await before running
  ensureZoteroConfigSynced = syncZoteroConfig(context, zotero, lsp, outputChannel);

  // register commands
  const commands: Command[] = [];
  commands.push(new ZoteroConfigureLibraryCommand(kZoteroConfigureLibrary, context, zotero));
  commands.push(new ZoteroSyncWebLibraryCommand(kZoteroSyncWebLibrary, context, zotero));
  commands.push(new ZoteroUnauthorizedCommand(kZoteroUnauthorized, context, zotero));

  // return commands
  return commands;
}


function syncZoteroConfig(context: ExtensionContext, zotero: ZoteroServer, lsp: QuartoLspClient, outputChannel: LogOutputChannel): () => Promise<void> {

  // the config push can race server startup (running != ready for custom
  // requests), so failed pushes are retried at a fixed delay
  const kMaxPushAttempts = 5;
  const kPushRetryDelayMs = 1000;

  // after a failed retry cycle, requests skip retrying until this cooldown
  // elapses, so a persistent failure doesn't retry on every citation lookup
  const kSyncFailureCooldownMs = 30_000;
  let retryAfter = 0;

  const kZoteroConfig = "quarto.zotero";
  const kLibrary = "library";
  const kZoteroLibrary = `${kZoteroConfig}.${kLibrary}`;
  const kDataDir = "dataDir";
  const kZoteroDataDir = `${kZoteroConfig}.${kDataDir}`;
  const kGroupLibraries = "groupLibraries";
  const kZoteroGroupLibraries = `${kZoteroConfig}.${kGroupLibraries}`;

  // read the currently configured library settings
  const readLibraryConfig = async (): Promise<ZoteroLibraryConfig> => {
    const zoteroConfig = workspace.getConfiguration(kZoteroConfig);
    return {
      type: zoteroConfig.get<"none" | "local" | "web">(kLibrary, "local"),
      dataDir: zoteroConfig.get<string>(kDataDir, ""),
      apiKey: await safeReadZoteroApiKey(context)
    };
  };

  // push a library config to the LSP server, returning success; takes config
  // as a param so retries don't re-read config/secrets on every attempt
  const pushLibraryConfig = async (config: ZoteroLibraryConfig): Promise<boolean> => {
    try {
      await zotero.setLibraryConfig(config);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      outputChannel.warn("Error setting zotero library config: " + message);
      return false;
    }
  };

  // Log a failure, clear the memo so the next request retries (a single
  // failure must not disable Zotero for the session, see
  // https://github.com/quarto-dev/quarto/issues/1101), and warn the user
  // with a retry option.
  const notifySyncFailure = (message: string) => {
    outputChannel.warn(message);
    configSyncPromise = undefined;
    retryAfter = Date.now() + kSyncFailureCooldownMs;
    const kRetry = "Retry";
    void window.showWarningMessage(
      "Quarto could not configure the connection to your Zotero library, " +
      "so Zotero may be unavailable as a citation source.",
      kRetry
    ).then((result) => {
      if (result === kRetry) {
        // user-initiated retry bypasses the cooldown
        retryAfter = 0;
        void ensureLibraryConfigSynced();
      }
    });
  };

  // Ensure the initial library config has been pushed to a running server.
  // Memoized so the many potential callers (server startup, and every Zotero
  // data request) only trigger a single push. It starts the server if needed,
  // which is also what prevents a deadlock: a Zotero data request that awaits
  // this gate before it ever hits the transport would otherwise wait forever
  // for a config sync that never happens because nothing started the server.
  // Note `pushLibraryConfig` uses the ungated `zotero` connection, so its own
  // `setLibraryConfig` call does not wait on this gate. After a failure,
  // calls during the cooldown above resolve immediately without retrying.
  let configSyncPromise: Promise<void> | undefined;
  const ensureLibraryConfigSynced = (): Promise<void> => {
    if (!configSyncPromise) {
      if (Date.now() < retryAfter) {
        return Promise.resolve();
      }
      configSyncPromise = (async () => {
        try {
          await lsp.ensureStarted();
        } catch (error) {
          const message = error instanceof Error ? error.message : JSON.stringify(error);
          notifySyncFailure("Unable to start Quarto LSP server to sync zotero library config: " + message);
          return;
        }
        const config = await readLibraryConfig();
        for (let attempt = 1; attempt <= kMaxPushAttempts; attempt++) {
          if (await pushLibraryConfig(config)) {
            return;
          }
          if (attempt < kMaxPushAttempts) {
            await sleep(kPushRetryDelayMs);
          }
        }
        notifySyncFailure(
          `Unable to sync zotero library config after ${kMaxPushAttempts} attempts; ` +
          `will retry on the next zotero request after a ${kSyncFailureCooldownMs / 1000}s cooldown.`
        );
      })();
    }
    return configSyncPromise;
  };

  // push config as soon as the server starts, so citation completion is ready
  // without waiting for the first Zotero request (matches prior eager behavior)
  context.subscriptions.push(lsp.onReady(() => { void ensureLibraryConfigSynced(); }));

  // push config on change, but only if the server is already running; route
  // through the same gate as the initial sync so a failure here retries and
  // notifies the user just like an initial sync failure would
  const pushLibraryConfigIfRunning = async () => {
    if (lsp.runningClient()) {
      configSyncPromise = undefined;
      await ensureLibraryConfigSynced();
    }
  };

  // note initial group library config (for detecting changes)
  const zoteroConfig = workspace.getConfiguration(kZoteroConfig);
  let groupLibraries = zoteroConfig.get<string[]>(kGroupLibraries, []);

  // monitor changes to web api key and update lsp
  context.secrets.onDidChange(async (e) => {
    if (e.key === kQuartoZoteroWebApiKey) {
      await pushLibraryConfigIfRunning();
    }
  });

  // monitor changes to configuration
  context.subscriptions.push(workspace.onDidChangeConfiguration(async (e) => {

    // sync changes to base config
    if (e.affectsConfiguration(kZoteroLibrary) ||
      e.affectsConfiguration(kZoteroDataDir)) {

      // if we are switching to web then prompt for an api key if we don't have one
      const zoteroConfig = workspace.getConfiguration(kZoteroConfig);
      if (zoteroConfig.get(kLibrary) === "web" &&
        !(await safeReadZoteroApiKey(context))) {
        await commands.executeCommand(kZoteroConfigureLibrary);
      } else {
        await pushLibraryConfigIfRunning();
      }
    }

    // initiate a sync for web group libraries
    if (e.affectsConfiguration(kZoteroGroupLibraries)) {
      // read updated library list
      const zoteroConfig = workspace.getConfiguration(kZoteroConfig);
      const updatedGroupLibraries = zoteroConfig.get<string[]>(kGroupLibraries, []);

      // sync if we are in web mode and there are new libraries added
      if (zoteroConfig.get(kLibrary) === "web" &&
        updatedGroupLibraries.length > groupLibraries.length) {
        const apiKey = await safeReadZoteroApiKey(context);
        if (apiKey) {
          await syncWebLibraries(apiKey);
        }
      }

      // update persistent list
      groupLibraries = updatedGroupLibraries;
    }
  }));

  return ensureLibraryConfigSynced;
}

// proxy for zotero requests that:
// (a) forwards the currently configured collections (group libraries)
// (b) checks for unauthorized errors and prompts for re-authorization
export function zoteroLspProxy(lspRequest: JsonRpcRequestTransport) {

  // Gate Zotero requests on the initial library-config sync so the backend
  // knows the configured library before answering. Without this, the lazily
  // started LSP could receive a data request (which itself triggered startup)
  // before `setLibraryConfig`, returning empty results. The gate also starts
  // the server if it isn't running yet, so a Zotero request can drive startup.
  const gatedRequest: JsonRpcRequestTransport = async (method, params) => {
    await ensureZoteroConfigSynced();
    return lspRequest(method, params);
  };

  const zoteroLsp = editorZoteroJsonRpcServer(gatedRequest);

  const handleZoteroResult = (result: ZoteroResult) => {
    if (result.status === 'notfound' && result.unauthorized) {
      commands.executeCommand(kZoteroUnauthorized);
    }
    return result;
  };

  const collectionsForFile = (collections: string[], file: string | null) => {
    const fileCollections = [...collections];
    if (fileCollections.length === 0) {
      const zoteroConfig = workspace.getConfiguration(
        "quarto.zotero",
        file ? Uri.file(file) : null
      );
      const groupLibraries = zoteroConfig.get<string[]>("groupLibraries", []);
      fileCollections.push(...groupLibraries);
    }
    if (!fileCollections.includes(kZoteroMyLibrary)) {
      fileCollections.push(kZoteroMyLibrary);
    }
    return fileCollections;
  };

  return zoteroServerMethods({

    ...zoteroLsp,

    getCollections: async (
      file: string | null,
      collections: string[],
      cached: ZoteroCollectionSpec[],
      useCache: boolean,
    ): Promise<ZoteroResult> => {
      return handleZoteroResult(
        await zoteroLsp.getCollections(
          file,
          collectionsForFile(collections, file),
          cached,
          useCache
        )
      );
    },

    getLibraryNames: async (): Promise<ZoteroResult> => {
      return handleZoteroResult(
        await zoteroLsp.getLibraryNames()
      );
    },

    getActiveCollectionSpecs: async (file: string | null, collections: string[]): Promise<ZoteroResult> => {
      return handleZoteroResult(
        await zoteroLsp.getActiveCollectionSpecs(
          file,
          collectionsForFile(collections, file)
        )
      );
    }
  });
}


class ZoteroConfigureLibraryCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context: ExtensionContext,
    private readonly zotero: ZoteroServer
  ) { }

  async execute() {

    const inputBox = window.createInputBox();
    inputBox.title = "Connect Zotero Web Library";
    inputBox.prompt = "Provide a Zotero Web API key to enable support for Zotero citations in " +
      "the Quarto Visual Editor. You can generate keys at https://www.zotero.org/settings/keys";
    inputBox.password = true;
    inputBox.ignoreFocusOut = true;
    inputBox.placeholder = "Zotero Web API Key";
    inputBox.onDidAccept(async () => {

      // get key
      const apiKey = inputBox.value.trim();

      // helper to save it
      const saveApiKey = async () => {
        await this.context.secrets.store(kQuartoZoteroWebApiKey, apiKey);
        inputBox.hide();
      };

      if (apiKey) {
        const valid = await zoteroValidateApiKey(apiKey);
        if (!valid) {
          inputBox.validationMessage = "The API key you entered could not be validated with the Zotero web service. " +
            "Please ensure that you have entered the key correctly and that it is currently valid.";
        } else {
          // save the secret and notify the server
          await saveApiKey();

          // kickoff a sync
          await syncWebLibraries(apiKey);
        }
      } else {
        await saveApiKey();
      }
    });
    inputBox.onDidChangeValue(() => {
      inputBox.validationMessage = "";
    });

    inputBox.show();
  }
}

class ZoteroSyncWebLibraryCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context: ExtensionContext,
    private readonly zotero: ZoteroServer
  ) { }

  async execute() {
    const apiKey = await safeReadZoteroApiKey(this.context);
    if (apiKey) {
      await syncWebLibraries(apiKey);
    } else {
      const result = await window.showInformationMessage(
        "Zotero Web Library Not Configured",
        {
          modal: true,
          detail: `You do not currently have a Zotero web library configured.` +
            `Do you want to configure a web library now?`
        },
        "Yes",
        "No"
      );
      if (result === "Yes") {
        await commands.executeCommand(kZoteroConfigureLibrary);
      }
    }
  }
}

class ZoteroUnauthorizedCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context: ExtensionContext,
    private readonly zotero: ZoteroServer
  ) { }

  async execute() {
    const kYes = "Configure Zotero API Key";
    const kNo = "Disable Zotero Web Library";
    const result = await window.showInformationMessage(
      "Zotero API Key Unauthorized",
      {
        modal: true,
        detail: `Your Zotero API key is no longer authorized. ` +
          `Do you want to configure a new API key now?`
      },
      kYes,
      kNo
    );
    if (result === kYes) {
      await commands.executeCommand(kZoteroConfigureLibrary);
    } else if (result === kNo) {
      await this.context.secrets.store(kQuartoZoteroWebApiKey, "");
    }
  }
}

async function syncWebLibraries(apiKey: string) {

  window.withProgress({
    title: "Zotero Sync",
    location: ProgressLocation.Notification,
    cancellable: true
  }, async (progress, token) => {

    // progress handler
    let progressRemaining = 100;
    const progressHandler = {
      report(message: string, increment?: number) {
        if (token.isCancellationRequested) {
          throw new SyncCancelledError();
        }
        increment = increment || (progressRemaining * 0.1);
        progressRemaining -= increment;
        progress.report({ message, increment });
      },
      log() {
        // don't log in foreground sync
      },
      cancelled() {
        return token.isCancellationRequested;
      }
    };

    // perform sync
    try {
      const zotero = await zoteroApi(apiKey, progressHandler);
      await zoteroSyncWebLibraries(zotero, progressHandler);
    } catch (error) {
      if (!(error instanceof SyncCancelledError)) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        window.showErrorMessage("Error occurred during sync: " + message);
        console.error(error);
      }
    }
  });
}

class SyncCancelledError extends Error {
  constructor() {
    super("Sync Cancelled");
  }
}

async function safeReadZoteroApiKey(context: ExtensionContext) {
  try {
    return await context.secrets.get(kQuartoZoteroWebApiKey);
  } catch (error) {
    console.log("Error reading zotero api key");
    return undefined;
  }
}
