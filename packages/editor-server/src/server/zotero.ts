/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * zotero.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { JsonRpcServerMethod } from "core";
import { 
  kZoteroBetterBibtexExport, 
  kZoteroGetActiveCollectionSpecs, 
  kZoteroGetCollections, 
  kZoteroGetLibraryNames, 
  kZoteroMyLibrary, 
  kZoteroSetLibraryConfig,
  kZoteroValidateWebApiKey, 
  ZoteroCollectionSource, 
  ZoteroCollectionSpec, 
  ZoteroLibraryConfig, 
  ZoteroResult,  
  ZoteroServer 
} from "editor-types";
import { zoteroValidateApiKey, zoteroWebCollectionSource } from "../core/zotero/web";

export function zoteroServer(): ZoteroServer {

  let source: ZoteroCollectionSource | undefined;

  return {

    async setLibraryConfig(config: ZoteroLibraryConfig): Promise<void> {
      // reconfigure source
      source = undefined;

      // web
      if (config.type === "web" && config.apiKey) {
        source = zoteroWebCollectionSource(config.apiKey); 

      // local
      } else if (config.type === "local") {
        const { zoteroLocalCollectionSource } = await import("../core/zotero/local");
        source = zoteroLocalCollectionSource(config.dataDir);
      }

    },

    async validateWebAPIKey(key: string): Promise<boolean> {
      return zoteroValidateApiKey(key);
    },

    async getCollections(
      _file: string | null,
      collections: string[],
      cached: ZoteroCollectionSpec[],
      _useCache: boolean
    ): Promise<ZoteroResult> {
      if (source) {
        if (collections.length === 0) {
          collections.push(kZoteroMyLibrary);
        }
        return await source.getCollections(collections, cached);
      } else {
        return zoteroResultEmpty();
      }
    },

    async getLibraryNames(): Promise<ZoteroResult> {
      if (source) {
        return source.getLibraryNames();
      } else {
        return zoteroResultEmpty();
      }
    },

    async getActiveCollectionSpecs(
      file: string | null,
      collections: string[]
    ): Promise<ZoteroResult> {
      if (source) {
        if (collections.length === 0) {
          collections.push(kZoteroMyLibrary);
        }
        return await source.getActiveCollectionSpecs(collections);
      } else {
        return zoteroResultEmpty();
      }
    },

    // Return status: nohost w/ warning text if it fails to
    // communciate w/ Better BibTeX. Otherwise returns
    // status: ok with exported text in message.
    betterBibtexExport(
      _itemKeys: string[],
      _translatorId: string,
      _libraryId: number
    ): Promise<ZoteroResult> {
      throw new Error("not supported");
    },
  };
}

export function zoteroServerMethods(server?: ZoteroServer) : Record<string, JsonRpcServerMethod> {
  server = server || zoteroServer();
  const methods: Record<string, JsonRpcServerMethod> = {
    [kZoteroSetLibraryConfig]: args => server!.setLibraryConfig(args[0]),
    [kZoteroValidateWebApiKey]: args => server!.validateWebAPIKey(args[0]),
    [kZoteroGetCollections]: args => server!.getCollections(args[0], args[1], args[2], args[3]),
    [kZoteroGetLibraryNames]: () => server!.getLibraryNames(),
    [kZoteroGetActiveCollectionSpecs]: args => server!.getActiveCollectionSpecs(args[0], args[1]),
    [kZoteroBetterBibtexExport]: args => server!.betterBibtexExport(args[0], args[1], args[2])
  }
  return methods;
}


function zoteroResultEmpty(message = []) : ZoteroResult {
  return {
    status: 'ok',
    message,
    warning: '',
    error: ''
  }
}