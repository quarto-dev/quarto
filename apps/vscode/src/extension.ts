/*
 * extension.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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

import * as vscode from "vscode";
import { MarkdownEngine } from "./markdown/engine";
import { activateBackgroundHighlighter } from "./providers/background";
import { Command, CommandManager } from "./core/command";
import { newDocumentCommands } from "./providers/newdoc";
import { insertCommands } from "./providers/insert";
import { activateDiagram } from "./providers/diagram/diagram";
import { activateOptionEnterProvider } from "./providers/option";
import { textFormattingCommands } from "./providers/text-format";
import { activateCodeFormatting } from "./providers/format";
import { activateContextKeySetter } from "./providers/context-keys";
import { ExtensionHost } from "./host";
import path, { dirname } from "node:path";
import { readFileSync } from "node:fs";

export function getActiveThemeName(): string | undefined {
  return vscode.workspace.getConfiguration("workbench").get("colorTheme");
}
// reference: https://github.com/microsoft/vscode/issues/32813#issuecomment-524174937
// reference: https://github.com/textX/textX-LS/blob/master/client/src/utils.ts
export function getTokenColorsForTheme(themeName: string | undefined): Map<any, any> {
  const tokenColors = new Map();
  if (!themeName) return tokenColors;
  let currentThemePath;
  for (const extension of vscode.extensions.all) {
    const themes = extension.packageJSON.contributes && extension.packageJSON.contributes.themes;
    const currentTheme = themes && themes.find((theme: any) => theme.id === themeName);
    if (currentTheme) {
      currentThemePath = path.join(extension.extensionPath, currentTheme.path);
      break;
    }
  }
  const themePaths = [];
  if (currentThemePath) { themePaths.push(currentThemePath); }
  while (themePaths.length > 0) {
    const themePath = themePaths.pop();
    if (themePath === undefined) return tokenColors;
    const theme = loadJSON(themePath);
    if (theme) {
      if (theme.include) {
        themePaths.push(path.join(dirname(themePath), theme.include));
      }
      if (theme.tokenColors) {
        theme.tokenColors.forEach((rule: any) => {
          if (typeof rule.scope === "string" && !tokenColors.has(rule.scope)) {
            tokenColors.set(rule.scope, rule.settings);
          } else if (rule.scope instanceof Array) {
            rule.scope.forEach((scope: any) => {
              if (!tokenColors.has(rule.scope)) {
                tokenColors.set(scope, rule.settings);
              }
            });
          }
        });
      }
    }
  }
  return tokenColors;
}
export function loadJSON(path: string): any {
  try {
    return JSON.parse(readFileSync(path).toString());
  } catch { }
}

export function activateCommon(
  context: vscode.ExtensionContext,
  host: ExtensionHost,
  engine: MarkdownEngine,
  commands?: Command[]
) {
  console.log(
    'HELLO getCurrentTheme',
    getActiveThemeName(),
    //[...getTokenColorsForTheme(getActiveThemeName()).entries()].map(([k, v]) => [k, Object.entries(v)])
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme((e) => {
      const name = getActiveThemeName()
      //const a = getTokenColorsForTheme(getActiveThemeName()).get('variable')
      //console.log('YOYOLO theme changed!', e, name, a)
    })
  );
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('workbench.colorTheme')) {
      // Theme has changed
      const currentTheme = vscode.workspace.getConfiguration().get('workbench.colorTheme');
      console.log(`Active theme changed to: ${currentTheme}`);
      // You can now use 'currentTheme' for your extension's logic
    }
  });

  // option enter handler
  activateOptionEnterProvider(context, engine);

  // background highlighter
  activateBackgroundHighlighter(context, engine);

  // context setter
  activateContextKeySetter(context, engine);

  // diagramming
  const diagramCommands = activateDiagram(context, host, engine);

  // code formatting
  const codeFormattingCommands = activateCodeFormatting(engine);

  // commands (common + passed)
  const commandManager = new CommandManager();
  for (const cmd of codeFormattingCommands) {
    commandManager.register(cmd);
  }
  for (const cmd of textFormattingCommands()) {
    commandManager.register(cmd);
  }
  for (const cmd of newDocumentCommands()) {
    commandManager.register(cmd);
  }
  for (const cmd of insertCommands(engine)) {
    commandManager.register(cmd);
  }
  for (const cmd of diagramCommands) {
    commandManager.register(cmd);
  }
  if (commands) {
    for (const cmd of commands) {
      commandManager.register(cmd);
    }
  }
  context.subscriptions.push(commandManager);
}
