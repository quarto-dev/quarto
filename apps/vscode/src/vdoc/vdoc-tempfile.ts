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

/**
 * Create a virtual document temp file and open it as a text document.
 *
 * Unlike `virtualDocUriFromTempFile`, this does not perform a hover warmup.
 * The returned `cleanup` function deletes the temp file and resets the
 * document's language so the language server clears its diagnostics.
 *
 * @param virtualDoc The virtual document content
 * @param docPath Path to the parent document (used for local file placement)
 * @param local Whether to create the file alongside the parent document
 */
export async function createVirtualDocFile(
  virtualDoc: VirtualDoc,
  docPath: string,
  local: boolean
): Promise<VirtualDocUri> {
  const useLocal = local || virtualDoc.language.localTempFile;

  // If `useLocal`, then create the temporary document alongside the `docPath`
  // so tools like formatters have access to workspace configuration. Otherwise,
  // create it in a temp directory.
  const virtualDocFilepath = useLocal
    ? createVirtualDocLocalFile(virtualDoc, path.dirname(docPath))
    : createVirtualDocTempfile(virtualDoc);

  const virtualDocUri = Uri.file(virtualDocFilepath);
  const virtualDocTextDocument = await workspace.openTextDocument(virtualDocUri);

  return {
    uri: virtualDocTextDocument.uri,
    cleanup: async () => await deleteDocument(virtualDocTextDocument),
  };
}

/**
 * Create an on disk temporary file containing the contents of the virtual document
 *
 * @param virtualDoc The document to use when populating the temporary file
 * @param docPath The path to the original document the virtual document is
 *   based on. When `local` is `true`, this is used to determine the directory
 *   to create the temporary file in.
 * @param local Whether or not the temporary file should be created "locally" in
 *   the workspace next to `docPath` or in a temporary directory outside the
 *   workspace.
 * @returns A `VirtualDocUri`
 */
export async function virtualDocUriFromTempFile(
  virtualDoc: VirtualDoc,
  docPath: string,
  local: boolean
): Promise<VirtualDocUri> {
  const result = await createVirtualDocFile(virtualDoc, docPath, local);
  const useLocal = local || virtualDoc.language.localTempFile;

  if (!useLocal) {
    // TODO: Reevaluate whether this warmup is necessary.
    await commands.executeCommand<Hover[]>(
      "vscode.executeHoverProvider",
      result.uri,
      new Position(0, 0)
    );
  }

  return result;
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
async function deleteDocument(doc: TextDocument) {
  try {
    // First set the language to 'raw' so that the language client
    // closes the text document in the language server, which clears
    // diagnostics for the file. This stops diagnostics from building
    // up even after virtual docs are cleaned up.
    await languages.setTextDocumentLanguage(doc, "plaintext");

    await workspace.fs.delete(doc.uri, {
      useTrash: false
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.log(`Error removing vdoc at ${doc.fileName}: ${msg}`);
  }
}

tmp.setGracefulCleanup();
export const VIRTUAL_DOC_TEMP_DIRECTORY = tmp.dirSync().name;

/**
 * Creates a virtual document in a temporary directory
 *
 * The temporary directory is automatically cleaned up on process exit.
 *
 * @param virtualDoc The document to use when populating the temporary file
 * @returns The path to the temporary file
 */
function createVirtualDocTempfile(virtualDoc: VirtualDoc): string {
  const filepath = generateVirtualDocFilepath(VIRTUAL_DOC_TEMP_DIRECTORY, virtualDoc.language.extension);
  createVirtualDoc(filepath, virtualDoc.content);
  return filepath;
}

/**
 * Creates a virtual document in the provided directory
 *
 * @param virtualDoc The document to use when populating the temporary file
 * @param directory The directory to create the temporary file in
 * @returns The path to the temporary file
 */
function createVirtualDocLocalFile(virtualDoc: VirtualDoc, directory: string): string {
  const filepath = generateVirtualDocFilepath(directory, virtualDoc.language.extension);
  createVirtualDoc(filepath, virtualDoc.content);
  return filepath;
}

/**
 * Creates a file filled with the provided content
 */
function createVirtualDoc(filepath: string, content: string): void {
  const directory = path.dirname(filepath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
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

export function isVirtualDoc(uri: Uri): boolean {
  // Check for tempfile virtual docs
  if (uri.scheme === "file") {
    const filename = path.basename(uri.fsPath);
    // Virtual docs have a specific filename pattern .vdoc.[uuid].[extension]
    return filename.startsWith(".vdoc.") && filename.split(".").length > 3;
  }

  return false;
}
