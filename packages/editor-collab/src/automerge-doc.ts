/*
 * automerge-doc.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
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

import { unstable as Automerge } from "@automerge/automerge";

import localforage from "localforage";

const kLocalStorageId = "editor-collab-doc-version-1";

export const kDocContentKey = "content";

export type DocType = { [kDocContentKey]: string };

export function initDoc() : Automerge.Doc<DocType> {
  const [doc] = Automerge.applyChanges(Automerge.init<DocType>(), [kInitialDoc]);
  return doc;
}

export async function loadDoc() : Promise<Automerge.Doc<DocType>> {
  const docData = await localforage.getItem<Uint8Array>(kLocalStorageId);
  if (docData) {
    return Automerge.load(docData);
  } else {
    return initDoc();
  }
}

export async function saveDoc(doc: Automerge.Doc<DocType>) {
  const docData = Automerge.save(doc)
  await localforage.setItem(kLocalStorageId, docData);
}


// "The quick brown fox jumped over the lazy dog."
const kInitialDoc = new Uint8Array([
  133, 111, 74, 131, 70, 85, 13, 176, 1, 131, 1, 0, 16, 195, 238, 4, 46, 140, 7,
  70, 109, 181, 221, 49, 150, 226, 119, 82, 41, 1, 1, 0, 0, 0, 10, 1, 4, 2, 4,
  17, 4, 19, 7, 21, 11, 52, 2, 66, 4, 86, 4, 87, 45, 112, 2, 0, 1, 45, 0, 0, 1,
  45, 1, 0, 2, 44, 0, 0, 1, 126, 0, 2, 43, 1, 127, 7, 99, 111, 110, 116, 101,
  110, 116, 0, 45, 1, 45, 127, 4, 45, 1, 127, 0, 45, 22, 84, 104, 101, 32, 113,
  117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106,
  117, 109, 112, 101, 100, 32, 111, 118, 101, 114, 32, 116, 104, 101, 32, 108,
  97, 122, 121, 32, 100, 111, 103, 46, 46, 0,
]);






