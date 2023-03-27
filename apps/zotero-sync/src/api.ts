


import fetch from "cross-fetch";

import { handleResponseWithStatus } from "core-node";
import { CSL } from "editor-types";

export interface ZoteroApi {
  user() : Promise<User>;

  groupVersions() : Promise<ObjectVersions>;
  group(groupID: number) : Promise<VersionedResponse<Group>>;

  collectionVersions(since: number, groupID?: number) : Promise<VersionedResponse<ObjectVersions>>;
  collections(keys: string[], groupID?: number) : Promise<VersionedResponse<Collection[]>>;
 
  itemVersions(since: number, groupId?: number) : Promise<VersionedResponse<ObjectVersions>>;
  items(keys: string[], groupID?: number) : Promise<VersionedResponse<Item[]>>;

}

export type VersionedResponse<T> = { data: T, version: number | null };

export interface GroupAccess {
  library: boolean;
  write: boolean;
}

export interface User {
  key: string;
  userID: string;
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

export type ObjectVersions = { [objectId: string]: number };

export function zoteroApi(key: string) : ZoteroApi {

  const kZoteroApiUrl = "https://api.zotero.org";
  const kUserInfoPath = "/keys/current";
  const kUserIDToken = "<userID>";

  // get user id on demand and cache it
  let userID: string | undefined;
  const user = async () => {
    const data = (await zoteroRequest<User>(kUserInfoPath)).data;
    userID = data.userID;
    return data;
  }

  // generic request handler
  const zoteroRequest = async <T>(path: string) : Promise<VersionedResponse<T>> => {
    // ensure userID if required
    if (path.includes(kUserIDToken) && !userID) {
      // caches userID as a side effect
      await user();
    }
    if (userID) {
      path = path.replace(kUserIDToken, userID);
    }
    const url = `${kZoteroApiUrl}${path}`;
    const req = () => fetch(url, {
      headers: {
        "Zotero-API-Version": "3",
        "Zotero-API-Key": key
      }
    });
    const response = await handleResponseWithStatus<T>(req);
    if (response.status === 200 && response.message) {
      const version = Number(response.headers?.get("Last-Modified-Version"));
      return {
        data: response.message,
        version: version || null 
      }
    } else {
      throw new Error(response.error);
    }
  }

  const objectPrefix = (groupID?: number) => {
    return  groupID !== undefined ? `/groups/${groupID}` : `/users/<userID>`;
  };

  return {
    user,

    groupVersions: async () => {
      const response =  await zoteroRequest<ObjectVersions>("/users/<userID>/groups?format=versions");
      return response.data;
    },

    group: async (groupID: number) => {
      const response = await zoteroRequest<Group>(`/groups/${groupID}`);
      return response;
    },

    collectionVersions: async (since: number, groupID?: number) : Promise<VersionedResponse<ObjectVersions>> => {
      const prefix = objectPrefix(groupID);
      const response = await zoteroRequest<ObjectVersions>(`${prefix}/collections?since=${since}&format=versions`);
      return response;
    },

    collections: async (keys: string[], groupID?: number) : Promise<VersionedResponse<Collection[]>> => {
      const prefix = objectPrefix(groupID);
      const query = `/collections?collectionKey=${keys.join(',')}`;
      const response = await zoteroRequest<Array<{ data: Collection }>>(`${prefix}${query}`);
      return {
        data: response.data.map(x => x.data),
        version: response.version

      }
    },

    itemVersions: async (since: number, groupID?: number) : Promise<VersionedResponse<ObjectVersions>> => {
      const prefix = objectPrefix(groupID);
      const query = `/items?since=${since}&itemType=-attachment&format=versions&includeTrashed=1`;
      const response = await zoteroRequest<ObjectVersions>(`${prefix}${query}`);
      return response;
    },

    items: async (keys: string[], groupID?: number) : Promise<VersionedResponse<Item[]>> => {
      const prefix = objectPrefix(groupID);
      const query = `/items?itemKey=${keys.join(',')}&format=json&include=csljson,data&includeTrashed=1`;
      const response = await zoteroRequest<Item[]>(`${prefix}${query}`);
      return response;
    }



   




  }


}