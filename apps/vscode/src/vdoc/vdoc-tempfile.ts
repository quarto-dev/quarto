/*
 * vdoc-tempfile.ts
 *
 * Copyright (C) 2022-2024 by Posit Software, PBC
 * Copyright (c) 2019 Takashi Tamura
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

import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import * as uuid from "uuid";
import {
  commands,
  Hover,
  Position,
  TextDocument,
  Uri,
  workspace,
  WorkspaceEdit,
} from "vscode";
import { VirtualDoc, VirtualDocUri } from "./vdoc";

export async function virtualDocUriFromTempFile(
  virtualDoc: VirtualDoc,
  docPath: string,
  local: boolean
): Promise<VirtualDocUri> {
  const newVirtualDocUri = (doc: TextDocument) =>
    <VirtualDocUri>{
      uri: doc.uri,
      cleanup: async () => await deleteDocument(doc),
    };

  // if this is local then create it alongside the docPath and return a cleanup
  // function to remove it when the action is completed.
  if (local || virtualDoc.language.localTempFile) {
    const ext = virtualDoc.language.extension;
    const vdocPath = path.join(path.dirname(docPath), `.vdoc.${ext}`);
    fs.writeFileSync(vdocPath, virtualDoc.content);
    const vdocUri = Uri.file(vdocPath);
    const doc = await workspace.openTextDocument(vdocUri);
    return newVirtualDocUri(doc);
  }

  // write the virtual doc as a temp file
  const vdocTempFile = createVirtualDocTempFile(virtualDoc);

  // open the document and save a reference to it
  const vdocUri = Uri.file(vdocTempFile);
  const doc = await workspace.openTextDocument(vdocUri);

  // TODO: Reevaluate whether this is necessary. Old comment:
  // > if this is the first time getting a virtual doc for this
  // > language then execute a dummy request to cause it to load
  await commands.executeCommand<Hover[]>(
    "vscode.executeHoverProvider",
    vdocUri,
    new Position(0, 0)
  );

  return newVirtualDocUri(doc);
}

// delete a document
async function deleteDocument(doc: TextDocument) {
  try {
    const edit = new WorkspaceEdit();
    edit.deleteFile(doc.uri);
    await workspace.applyEdit(edit);
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.log(`Error removing vdoc at ${doc.fileName}: ${msg}`);
  }
}

// create temp files for vdocs. use a base directory that has a subdirectory
// for each extension used within the document. this is a no-op if the
// file already exists
tmp.setGracefulCleanup();
const vdocTempDir = tmp.dirSync().name;
function createVirtualDocTempFile(virtualDoc: VirtualDoc) {
  const ext = virtualDoc.language.extension;
  const dir = path.join(vdocTempDir, ext);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const tmpPath = path.join(vdocTempDir, ext, ".intellisense." + uuid.v4() + "." + ext);
  fs.writeFileSync(tmpPath, virtualDoc.content);

  return tmpPath;
}
