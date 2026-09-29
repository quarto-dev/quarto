/*
 * images.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import * as fs from "fs";
import path from "path";

import { randomUUID } from "node:crypto";

import vscode, { TextDocument, Uri } from "vscode";

import { EditorUIImageResolver } from "editor-types";
import { isHttpUrl, kImageExtensions } from "core";


/**
 * Pick an unused file path in `imagesDir` for an image named `stem` + `ext`.
 *
 * Tries a short name with an integer suffix (`stem-1.png`, `stem-2.png`, ...;
 * with `preserveStem`, the bare `stem.png` is tried first). After 100
 * collisions it falls back to a random suffix, keeping the same directory and
 * extension.
 */
export function uniqueImagePath(
  imagesDir: string,
  stem: string,
  ext: string,
  preserveStem?: boolean,
  exists: (file: string) => boolean = fs.existsSync,
  uniqueId: () => string = randomUUID
): string {
  ext = ext || ".png";
  for (let i = 0; i < 100; i++) {
    const imagePath = path.join(imagesDir, `${stem}${(i > 0 || !preserveStem) ? ('-' + (i + 1)) : ''}${ext}`);
    if (!exists(imagePath)) {
      return imagePath;
    }
  }
  return path.join(imagesDir, `${stem}-${uniqueId()}${ext}`);
}

export function documentImageResolver(
  doc: TextDocument,
  projectDir?: string
): EditorUIImageResolver {

  // compute doc and project dirs
  const docDir = path.normalize(path.dirname(doc.fileName));
  projectDir = projectDir ? path.normalize(projectDir) : undefined;

  // sticky images dir (start out w/ docDir)
  let imagesDir = docDir;

  const ensureForwardSlashes = (path: string) => {
    return path.replace(/\\/, "/");
  };

  const ensureImagesDir = () => {
    const imagesDir = path.join(docDir, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir);
    }
    return imagesDir;
  };

  const resolveImage = (uri: string) => {
    uri = path.normalize(uri);
    const relative = (dir: string, file: string) => {
      return ensureForwardSlashes(path.relative(dir, file));
    };
    // doc dir relative
    if (uri.startsWith(docDir)) {
      return relative(docDir, uri);
      // project dir relative (start w/ slash)
    } else if (projectDir && uri.startsWith(projectDir)) {
      return `/${relative(projectDir, uri)}`;
      // otherwise copy to images dir
    } else {
      const parsedPath = path.parse(uri);
      const imagePath = uniqueImagePath(ensureImagesDir(), parsedPath.name, parsedPath.ext, true);
      fs.copyFileSync(uri, imagePath);
      return relative(docDir, imagePath);
    }
  };

  return {

    resolveImageUris: async (uris: string[]): Promise<string[]> => {
      return uris.map(uri => {
        if (isHttpUrl(uri)) {
          return uri;
        } else {
          return ensureForwardSlashes(resolveImage(uri));
        }
      });
    },
    resolveBase64Images: async (base64Images: string[]): Promise<string[]> => {
      return base64Images.map(base64 => {
        const kImgRegex = /^data:image\/(\w+);base64,/;
        const match = base64.match(kImgRegex);
        if (match) {
          const base64Data = base64.replace(kImgRegex, "");
          const imageBuffer = Buffer.from(base64Data, "base64");
          const imagePath = uniqueImagePath(ensureImagesDir(), "paste", `.${match[1]}`);
          fs.writeFileSync(imagePath, imageBuffer);
          return ensureForwardSlashes(path.relative(docDir, imagePath));
        } else {
          return null;
        }
        ;
      }).filter(image => image !== null) as string[];
    },
    selectImage: async (): Promise<string | null> => {
      const file = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { ["Images"]: kImageExtensions },
        title: "Select Image",
        defaultUri: Uri.file(imagesDir)
      });
      if (file) {
        const image = file[0].fsPath;
        imagesDir = path.dirname(image);
        return resolveImage(image);
      } else {
        return null;
      }
    }
  };
}
