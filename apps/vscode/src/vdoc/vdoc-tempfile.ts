/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) 2019 Takashi Tamura
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

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
import { getWholeRange } from "../core/doc";
import { VirtualDoc } from "./vdoc";

// one virtual doc per language file extension
const languageVirtualDocs = new Map<String, TextDocument>();

export async function virtualDocUriFromTempFile(virtualDoc: VirtualDoc) {
  // do we have an existing document?
  const langVdoc = languageVirtualDocs.get(virtualDoc.language.extension);
  if (langVdoc && !langVdoc.isClosed) {
    // some lsps require re-use of the vdoc (or else they exit)
    if (virtualDoc.language.reuseVdoc) {
      if (langVdoc.getText() !== virtualDoc.content) {
        const wholeDocRange = getWholeRange(langVdoc);
        const edit = new WorkspaceEdit();
        edit.replace(langVdoc.uri, wholeDocRange, virtualDoc.content);
        await workspace.applyEdit(edit);
        await langVdoc.save();
      }
      return langVdoc.uri;
    } else if (langVdoc.getText() === virtualDoc.content) {
      // if its content is identical to what's passed in then just return it
      return langVdoc.uri;
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
  return doc.uri;
}

// delete any vdocs left open
export async function deactivateVirtualDocTempFiles() {
  languageVirtualDocs.forEach(async (doc) => {
    await deleteDocument(doc);
  });
}

// delete a document
async function deleteDocument(doc: TextDocument) {
  const edit = new WorkspaceEdit();
  edit.deleteFile(doc.uri);
  await workspace.applyEdit(edit);
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
  const tmpPath = path.join(vdocTempDir, ext, "intellisense." + ext);

  fs.writeFileSync(tmpPath, virtualDoc.content);

  return tmpPath;
}
