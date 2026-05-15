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
  languages,
  Position,
  TextDocument,
  Uri,
  workspace,
} from "vscode";
import { VirtualDoc, VirtualDocUri } from "./vdoc";

interface VirtualDocTempFileOptions {
  /** Fire a hover request to prime the language server before returning. */
  warmup: boolean;
}

/**
 * Create an on-disk temporary file for a virtual document and open it.
 *
 * @param virtualDoc The virtual document content to write.
 * @param directory The directory to create the file in.
 */
export async function virtualDocUriFromTempFile(
  virtualDoc: VirtualDoc,
  directory: string,
  options: VirtualDocTempFileOptions,
): Promise<VirtualDocUri> {
  const filepath = generateVirtualDocFilepath(directory, virtualDoc.language.extension);
  createVirtualDoc(filepath, virtualDoc.content);

  const virtualDocUri = Uri.file(filepath);
  const virtualDocTextDocument = await workspace.openTextDocument(virtualDocUri);

  if (options.warmup) {
    // TODO: Reevaluate whether this is necessary. Old comment:
    // > if this is the first time getting a virtual doc for this
    // > language then execute a dummy request to cause it to load
    await commands.executeCommand<Hover[]>(
      "vscode.executeHoverProvider",
      virtualDocUri,
      new Position(0, 0)
    );
  }

  return {
    uri: virtualDocTextDocument.uri,
    cleanup: async () => await deleteDocument(virtualDocTextDocument),
  };
}

/**
 * Delete a virtual document's on disk temporary file
 *
 * Since this is an ephemeral file, we bypass the trash (Trash on Mac, Recycle
 * Bin on Windows) and permadelete it instead so our trash isn't cluttered with
 * thousands of these files. This should also avoid issues with users on network
 * drives, which don't necessarily have access to their Recycle Bin (#708).
 *
 * @param doc The `TextDocument` to delete
 */
export async function deleteDocument(doc: TextDocument) {
  try {
    // First set the language to 'plaintext' so that the language client
    // closes the text document in the language server, which clears
    // diagnostics for the file. This stops diagnostics from building
    // up even after virtual docs are cleaned up.
    //
    // Unfortunately, workspace.fs.delete does not trigger the
    // vscode.window.onDidCloseTextDocument event, which the language
    // client relies on to send the textDocument/didClose notification
    // to the language server.
    //
    // vscode.WorkspaceEdit *does* trigger onDidCloseTextDocument,
    // but doesn't support skipping the trash - see the note above
    // re #708.
    await languages.setTextDocumentLanguage(doc, "plaintext");

    await workspace.fs.delete(doc.uri, {
      useTrash: false
    });
  } catch (error) {
    // It's okay if the file is already deleted.
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return;
    }
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Error removing vdoc at ${doc.fileName}: ${msg}`);
  }
}

tmp.setGracefulCleanup();
export const VIRTUAL_DOC_TEMP_DIRECTORY = tmp.dirSync().name;

/**
 * Resolves the `.quarto/vdoc/` directory for the workspace containing `docPath`.
 *
 * Falls back to the source file's directory if no workspace folder is found
 * (e.g., when working with a single file outside a workspace).
 */
export function quartoVdocDir(docPath: string): string {
  const sourceDirectory = path.dirname(docPath);
  const workspaceFolder = workspace.workspaceFolders?.find(
    (folder) => sourceDirectory.startsWith(folder.uri.fsPath)
  );
  return workspaceFolder
    ? Uri.joinPath(workspaceFolder.uri, ".quarto", "vdoc").fsPath
    : sourceDirectory;
}

/**
 * Creates a file filled with the provided content
 */
function createVirtualDoc(filepath: string, content: string): void {
  const directory = path.dirname(filepath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(filepath, content);
}

/**
 * Generates a unique virtual document file path
 *
 * It is important for virtual documents to have unique file paths. If a static
 * name like `.vdoc.{ext}` is used, it is possible for one language server
 * request to overwrite the contents of the virtual document while another
 * language server request is running (#683).
 */
function generateVirtualDocFilepath(directory: string, extension: string): string {
  return path.join(directory, ".vdoc." + uuid.v4() + "." + extension);
}
