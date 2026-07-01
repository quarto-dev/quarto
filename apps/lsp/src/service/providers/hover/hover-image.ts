/*
 * hover-image.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import * as path from "path";
import * as fs from "fs";
import * as url from "url";
import { Document } from "quarto-core"
import { Hover, MarkupKind, Position, Range } from "vscode-languageserver-types";
import { IWorkspace } from "../../workspace";

const kImagePattern =
  /(!\[((!\[[^\]]*?\]\(\s*)([^\s()]+?)\s*\)\]|(?:\\\]|[^\]])*\])\(\s*)(([^\s()]|\([^\s()]*?\))+)\s*(".*?")?\)/g;

export function imageHover(workspace: IWorkspace) {
  return async (
    doc: Document,
    pos: Position
  ): Promise<Hover | null> => {
    const lineRange = Range.create(pos.line, 0, pos.line + 1, 0);
    const line = doc.getText(lineRange).trimEnd();
    for (const match of line.matchAll(kImagePattern)) {
      if (
        match.index !== undefined &&
        pos.character >= match.index &&
        pos.character < match.index + match[0].length
      ) {
        // path can be either document relative or workspace rooted w/ "/"
        let imagePath = match[5];
        if (imagePath.startsWith("/") && workspace.workspaceFolders) {
          for (const wsFolder of workspace.workspaceFolders) {
            const wsRoot = url.fileURLToPath(wsFolder.toString());
            imagePath = path.join(wsRoot, imagePath.slice(1));
            break;
          }
        } else {
          imagePath = path.join(path.dirname(url.fileURLToPath(doc.uri)), imagePath);
        }
        imagePath = path.normalize(imagePath);
        if (fs.existsSync(imagePath)) {
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `![](${pngToDataUrl(imagePath)})`
            },
            range: lineRange,
          };
        }
      }
    }
    return null;
  }
}

function pngToDataUrl(png: string): string {
  // We have to call encodeURIComponent and unescape because SVG can includes non-ASCII characters.
  // We have to encode them before converting them to base64.
  const data = fs.readFileSync(png);
  const base64data = Buffer.from(data).toString('base64')
  const b64Start = "data:image/png;base64,";
  return b64Start + base64data;
}
