/*
 * server.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { CrossrefServer } from "./crossref";
import { DataCiteServer } from "./datacite";
import { DOIServer } from "./doi";
import { EnvironmentServer } from "./environment";
import { PandocServer } from "./pandoc";
import { PubMedServer } from "./pubmed";
import { XRefServer } from "./xref";
import { ZoteroServer } from "./zotero";

export const kStatusOK = "ok";
export const kStatusNotFound = "notfound";
export const kStatusNoHost = "nohost";
export const kStatusError = "error";

export interface EditorServer {
  readonly pandoc: PandocServer;
  readonly doi: DOIServer;
  readonly crossref: CrossrefServer;
  readonly datacite: DataCiteServer;
  readonly pubmed: PubMedServer;
  readonly xref: XRefServer;
  readonly zotero?: ZoteroServer;
  readonly environment?: EnvironmentServer;
}
