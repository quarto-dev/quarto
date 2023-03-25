


import fetch from "cross-fetch";

import { handleResponseWithStatus } from "core-node";


export interface ZoteroApi {
  userInfo() : Promise<UserInfo>;

  groupVersions() : Promise<ObjectVersions>;
  group(groupID: number) : Promise<unknown>;

  //collectionVersions(since: number) : Promise<ObjectVersions>;

}

export interface GroupAccess {
  library: boolean;
  write: boolean;
}

export interface UserInfo {
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

export type ObjectVersions = { [objectId: string]: number };

export function zoteroApi(key: string) : ZoteroApi {

  const kZoteroApiUrl = "https://api.zotero.org";
  const kUserInfoPath = "/keys/current";
  const kUserIDToken = "<userID>";

  // get user id on demand and cache it
  let userID: string | undefined;
  const userInfo = async () => {
    return zoteroRequest<UserInfo>(kUserInfoPath);
  }

  // generic request handler
  const zoteroRequest = async <T>(path: string) : Promise<T> => {
    // ensure userID if required
    if (path.includes(kUserIDToken) && !userID) {
      userID = (await userInfo()).userID;
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
      return response.message;
    } else {
      throw new Error(response.error);
    }
  }

  return {
    userInfo,

    groupVersions: async () : Promise<ObjectVersions> => {
      return zoteroRequest<ObjectVersions>("/users/<userID>/groups?format=versions");
    },

    group: async (groupID: number) : Promise<unknown> => {
      return zoteroRequest<unknown>(`/groups/${groupID}`)
    },

    /*
    collectionVersions: async (since: number, ) : Promise<ObjectVersions> => {
      
    }
    */

  }


}