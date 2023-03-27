/*
 * api.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { sleep } from "core";
import fetch from "cross-fetch";

import { CSL } from "editor-types";

export interface Library {
  type: "user" | "group";
  id: number;
}

export interface User {
  key: string;
  userID: number;
  username: string;
  displayName: string;
  access: {
    user: {
      library?: boolean;
      files?: boolean;
      notes?: boolean;
      write?: boolean;
    },
    groups: { [key: string]: GroupAccess }
  }
}

export interface GroupAccess {
  library: boolean;
  write: boolean;
}

export interface Group {
  id: number;
  version: number;
  name: string;
  owner: number;
  type: string;
  description: string;
  url: string;
  libraryEditing: string;
  libraryReading: string;
  fileEditing: string;
  members: number[];
}

export interface Collection {
  key: string;
  version: number;
  name: string;
  parentCollection: boolean;
  relations: Record<string,unknown>;
}

export interface Item {
  key: string;
  version: string;
  csljson: CSL;
  data: Record<string,unknown>;
}

export interface Deleted {
  collections: string[];
  searches: string[];
  items: string[];
  tags: string[];
}

export type ObjectVersions = { [objectId: string]: number };

export type VersionedResponse<T> = { data: T, version: number | null } | null;

export interface ZoteroApi {
  user() : Promise<User>;

  groupVersions(userID: number) : Promise<ObjectVersions>;
  group(groupID: number) : Promise<VersionedResponse<Group>>;

  collectionVersions(library: Library, since: number) : Promise<VersionedResponse<ObjectVersions>>;
  collections(library: Library, keys: string[], since: number) : Promise<VersionedResponse<Collection[]>>;
 
  itemVersions(library: Library, since: number) : Promise<VersionedResponse<ObjectVersions>>;
  items(library: Library, keys: string[], since: number) : Promise<VersionedResponse<Item[]>>;

  deleted(library: Library, since: number) : Promise<Deleted>;
}

export function zoteroApi(key: string) : ZoteroApi {

  const objectPrefix = (library: Library) => {
    return `/${library.type}s/${library.id}`;
  };

  return {
    user: () => {
      return zoteroRequest<User>(key, "/keys/current");
    },

    groupVersions: (userID: number) => {
      return zoteroRequest<ObjectVersions>(key, `/users/${userID}/groups?format=versions`);
    },

    group: (groupID: number) => {
      return zoteroVersionedRequest<Group>(key, `/groups/${groupID}`, 0);
    },

    collectionVersions: (library: Library, since: number) => {
      const prefix = objectPrefix(library);
      return zoteroVersionedRequest<ObjectVersions>(key, `${prefix}/collections?since=${since}&format=versions`, since);
    },

    collections: async (library: Library, keys: string[], since: number) => {
      const prefix = objectPrefix(library);
      const query = `/collections?collectionKey=${keys.join(',')}`;
      const response = await zoteroVersionedRequest<Array<{ data: Collection }>>(key, `${prefix}${query}`, since);
      if (response) {
        return {
          data: response.data.map(x => x.data),
          version: response.version
        }
      } else {
        return null;
      }
    },

    itemVersions: (library: Library, since: number) => {
      const prefix = objectPrefix(library);
      const query = `/items?since=${since}&itemType=-attachment&format=versions&includeTrashed=1`;
      return zoteroVersionedRequest<ObjectVersions>(key, `${prefix}${query}`, since);
    },

    items: (library: Library, keys: string[], since: number) => {
      const prefix = objectPrefix(library);
      const query = `/items?itemKey=${keys.join(',')}&format=json&include=csljson,data&includeTrashed=1`;
      return zoteroVersionedRequest<Item[]>(key, `${prefix}${query}`, since);
    },

    deleted: (library: Library, since: number) => {
      const prefix = objectPrefix(library);
      const query = `/deleted?since=${since}`;
      return zoteroRequest<Deleted>(key, `${prefix}${query}`);
    }
  }
}

interface ZoteroResponse<T> {
  status: number;
  statusText: string;
  headers: Headers | null;
  message: T | null;
}

// normal request handler
const zoteroRequest = async <T>(key: string, path: string) : Promise<T> => {
  const response = await zoteroFetch<T>(key, path);
  if (response.status === 200 && response.message) {
    return response.message;
  } else {
    throw new Error(response.statusText || "Unknown error");
  }
}

const zoteroVersionedRequest = async <T>(key: string, path: string, since: number) : Promise<VersionedResponse<T>> => {
  const response = await zoteroFetch<T>(key, path, { ["If-Modified-Since-Version"]: String(since) });
  if (response.status === 200 && response.message) {
    const version = Number(response.headers?.get("Last-Modified-Version"));
    return {
      data: response.message,
      version: version || null 
    }
  } else if (response.status === 304) {
    return null;
  } else {
    throw new Error(response.statusText || "Unknown error");
  }
}

const zoteroFetch = async <T>(
  key: string, 
  path: string, 
  headers = {} as Record<string,string>
) : Promise<ZoteroResponse<T>> => {
  try {
    const kMaxWait = 5 * 60;
    let totalWait = 0;
    let backoff = 0;
    let response: Response;
    do {
      // make request
      const url = `https://api.zotero.org${path}`;
      response = await fetch(url, {
        headers: {
          "Zotero-API-Version": "3",
          "Zotero-API-Key": key,
          ...headers
        }
      });

      // handle backoff headers
      // https://www.zotero.org/support/dev/web_api/v3/basics#rate_limiting
      const retryAfter = response.status === 429 ? Number(response.headers.get("Retry-After") || 0) : 0;
      backoff = Number(response.headers.get("Backoff") || 0) || retryAfter;
      if (backoff) {
        await sleep(backoff * 1000);
        totalWait += backoff;
      }  
    } while(backoff && (totalWait <= kMaxWait));

    // timed out
    if (totalWait > kMaxWait) {
      return {
        status: 503,
        statusText: "Service backoff time exceeded maximum",
        headers: null,
        message: null
      }
    }

    // return response
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      message: response.ok ? await response.json() as T  : null,
    }

  } catch(error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return {
      status: message.includes("ENOTFOUND") ? 503 : 500,
      statusText: `Error: ${message}`,
      headers: null,
      message: null,
    }
  }
}

