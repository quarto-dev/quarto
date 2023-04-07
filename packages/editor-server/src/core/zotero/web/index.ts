/*
 * index.ts
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


// TODO: consolidate getCollections and getCollectionSpecs

// TODO: on completion we lose our popup w/ streaming

// TODO: insert sequence calls getCollections over and over

// TODO: if the API key doesn't work surface an error to the user 
// (and possibly allow reset of ID?)

// TODO: write code to go all the way through to sync a collection
// TODO: implement realtime API to optmize this

// this is how we transform zotero rest api requests into ZoteroCollection
// https://github.com/rstudio/rstudio/blob/main/src/cpp/session/modules/zotero/ZoteroCollectionsWeb.cpp#L240


export { zoteroApi, validateApiKey } from './api';

export { syncLibrary, syncAllLibraries } from './sync';

export { webCollectionSource } from './source';



