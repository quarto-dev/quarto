/*
 * completion-shortcode.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

// TODO: improved base filtering (.., # at end, etc.)
// TODO: complete ids within ipynb
// TODO: visual editor completions
// TODO: completion on demand when there is no token at all

import path from 'path';

import { URI, Utils } from 'vscode-uri';
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";

import { EditorContext } from "../../quarto";
import { FileStat, IWorkspace, getWorkspaceFolder } from "../../workspace";
import { Schemes } from '../../util/schemes';

const kShortcodeRegex = /(^\s*{{< )(embed|include)(\s+)([^\s]+).*? >}}\s*$/;

export async function shortcodeCompletions(context: EditorContext, workspace: IWorkspace) : Promise<CompletionItem[] | null> {
  
  // bypass if the current line doesn't contain a {{< (performance optimization so we don't execute
  // the regexes below if we don't need to)
  if (context.line.indexOf("{{<") === -1) {
    return null;
  }

  const match = context.line.match(kShortcodeRegex);
  if (match) {
    // is the cursor in the file region (group 4) and is the 
    // next character a space?
    const beginFile = match[1].length + match[2].length + match[3].length;
    const endFile = beginFile + match[4].length;
    const col = context.position.column;
    if (col >= beginFile && col <= endFile && context.line[col] === " ") {
      // completion token and shortcode
      const shortcode = match[2];
      const token = match[4];

      // if the token is a directory reference then stand down
      if (token === "." || token === "..") {
        return null;
      }

      // find parent dir
      const valueBeforeLastSlash = token.substring(0, token.lastIndexOf('/') + 1); // keep the last slash
      const docUri = URI.file(context.path);
      const parentDir = resolveReference(docUri, workspace, valueBeforeLastSlash || '.');
      if (!parentDir) {
        return null;
      }

      let dirInfo: Iterable<readonly [string, FileStat]>;
      try {
        dirInfo = await workspace.readDirectory(parentDir);
      } catch {
        return null;
      }
    
      const completions: CompletionItem[] = [];
      for (const [name, type] of dirInfo) {
        
        // screen out hidden
        if (name.startsWith(".")) {
          continue;
        }

        // screen based on embed type
        if (!type.isDirectory) {
          const ext = path.extname(name);
          if (shortcode === "include" && ![".md", ".qmd"].includes(ext.toLowerCase())) {
            continue;
          } else if (shortcode === "embed" && ext.toLowerCase() !== ".ipynb") {
            continue;
          }
        }
      
        // create completion
        const uri = Utils.joinPath(parentDir, name);
        const isDir = type.isDirectory;
        const label = isDir ? name + '/' : name;
        completions.push({
          label,
          kind: isDir ? CompletionItemKind.Folder : CompletionItemKind.File,
          documentation: isDir ? uri.path + '/' : uri.path,
          command: isDir ? { command: 'editor.action.triggerSuggest', title: '' } : undefined,
        });
      }
      return completions;
    }
    
  }



  return null;

}

function resolveReference(
  docUri: URI, 
  workspace: IWorkspace,
  ref: string): URI | undefined {
  
  if (ref.startsWith('/')) {
    const workspaceFolder = getWorkspaceFolder(workspace, docUri);
    if (workspaceFolder) {
      return Utils.joinPath(workspaceFolder, ref);
    } else {
      return resolvePath(docUri, ref.slice(1));
    }
  }

  return resolvePath(docUri, ref);
}

function resolvePath(root: URI, ref: string): URI | undefined {
  try {
    if (root.scheme === Schemes.file) {
      return URI.file(path.resolve(path.dirname(root.fsPath), ref));
    } else {
      return root.with({
        path: path.resolve(path.dirname(root.path), ref),
      });
    }
  } catch {
    return undefined;
  }
}