/*
 * documents.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import fs from "node:fs";

import { URI } from "vscode-uri";
import { TextDocuments } from "vscode-languageserver";

import {  Document } from "quarto-core";
export interface EditorServerDocument {
  filePath: string;
  code: string;
  lastModified: Date;
  version?: number;
}

export interface EditorServerDocuments {
  getDocument(filePath: string) : EditorServerDocument;
}

export function editorServerDocuments(documents: TextDocuments<Document>) {
  return {
    getDocument(filePath: string) {
      const uri = URI.file(filePath).toString();
      const lastModified = fs.statSync(filePath).mtime;
      const doc = documents.get(uri);
      if (doc) {
        return { 
          filePath,
          code: doc.getText(),
          lastModified,
          version: doc.version
        }
      } else {
        return {
          filePath,
          code: fs.readFileSync(filePath, { encoding: "utf-8" }),
          lastModified
        }
      }
    }
  }
}

export function editorDocumentsEqual(a: EditorServerDocument, b: EditorServerDocument) {
  return a.filePath === b.filePath &&
         a.code === b.code &&
         a.lastModified.getTime() === b.lastModified.getTime() &&
         a.version === b.version;
}

