/*
 * vdoc-tempfile.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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
import { EmbeddedLanguage } from "./languages";

// one virtual doc per language file extension
const languageVirtualDocs = new Map<String, TextDocument>();

export async function virtualDocUriFromTempFile(
  virtualDoc: VirtualDoc, 
  docPath: string, 
  local: boolean
) : Promise<VirtualDocUri> {

  // if this is local then create it alongside the docPath and return a cleanup 
  // function to remove it when the action is completed. 
  if (local || virtualDoc.language.localTempFile) {
    const ext = virtualDoc.language.extension;
    const vdocPath = path.join(path.dirname(docPath), `.vdoc.${ext}`);
    fs.writeFileSync(vdocPath, virtualDoc.content);
    const vdocUri = Uri.file(vdocPath);
    const doc = await workspace.openTextDocument(vdocUri);
    return {
      uri: doc.uri,
      cleanup: async () => await deleteDocument(doc)
    };
  }

  // do we have an existing document?
  const langVdoc = languageVirtualDocs.get(virtualDoc.language.extension);
  if (langVdoc && !langVdoc.isClosed) {
    if (langVdoc.getText() === virtualDoc.content) {
      // if its content is identical to what's passed in then just return it
      return { uri: langVdoc.uri };
    } else {
      // otherwise remove it (it will get recreated below)
      await deleteDocument(langVdoc);
      languageVirtualDocs.delete(virtualDoc.language.extension);
    }
  }

  // write the virtual doc as a temp file
  const vdocTempFile = createVirtualDocTempFile(virtualDoc);

  // open the document and save a reference to it
  const vdocUri = Uri.file(vdocTempFile);
  const doc = await workspace.openTextDocument(vdocUri);
  languageVirtualDocs.set(virtualDoc.language.extension, doc);

  // if this is the first time getting a virtual doc for this
  // language then execute a dummy request to cause it to load
  if (!langVdoc) {
    await commands.executeCommand<Hover[]>(
      "vscode.executeHoverProvider",
      vdocUri,
      new Position(0, 0)
    );
  }

  // return the uri
  return { uri: doc.uri };
}

// delete any vdocs left open
export async function deactivateVirtualDocTempFiles() {
  languageVirtualDocs.forEach(async (doc) => {
    await deleteDocument(doc);
  });
}

export function isLanguageVirtualDoc(language: EmbeddedLanguage, uri: Uri) {
  return languageVirtualDocs.get(language.extension)?.uri.toString() === uri.toString();
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
  const tmpPath = path.join(vdocTempDir, ext, ".intellisense." + ext);
  fs.writeFileSync(tmpPath, virtualDoc.content);

  return tmpPath;
}
