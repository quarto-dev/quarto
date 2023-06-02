/*
 * vscode-executors.ts
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


import { Uri, commands, window, extensions } from "vscode";

import semver from "semver";


export interface CellExecutor {
  execute: (blocks: string[], editorUri?: Uri) => Promise<void>;
  executeSelection?: () => Promise<void>;
}

export function executableLanguages() {
  return kCellExecutors.map(executor => executor.language);
}

export async function cellExecutorForLanguage(language: string, silent?: boolean) : Promise<CellExecutor | undefined> {
  const executor = findExecutor(language);
  if (executor) {
    if (await ensureRequiredExtension(language, silent)) {
      return executor;
    } 
  }
}

interface VSCodeCellExecutor extends CellExecutor {
  language: string;
  requiredExtensionName?: string;
  requiredExtension?: string[];
  requiredVersion?: string;
  execute: (blocks: string[], editorUri?: Uri) => Promise<void>;
  executeSelection?: () => Promise<void>;
}

const pythonCellExecutor: VSCodeCellExecutor = {
  language: "python",
  requiredExtension: ["ms-python.python"],
  requiredExtensionName: "Python",
  requiredVersion: "2021.8.0",
  execute: async (blocks: string[]) => {
    for (const block of blocks) {
      await commands.executeCommand("jupyter.execSelectionInteractive", block);
    }
  },
};

const rCellExecutor: VSCodeCellExecutor = {
  language: "r",
  requiredExtension: ["REditorSupport.r", "Ikuyadeu.r"],
  requiredExtensionName: "R",
  requiredVersion: "2.4.0",
  execute: async (blocks: string[]) => {
    await commands.executeCommand("r.runSelection", blocks.join("\n").trim());
  },
  executeSelection: async () => {
    await commands.executeCommand("r.runSelection");
  },
};

const juliaCellExecutor: VSCodeCellExecutor = {
  language: "julia",
  requiredExtension: ["julialang.language-julia"],
  requiredExtensionName: "Julia",
  requiredVersion: "1.4.0",
  execute: async (blocks: string[], editorUri?: Uri) => {
    const extension = extensions.getExtension("julialang.language-julia");
    if (extension) {
      if (!extension.isActive) {
        await extension.activate();
      }
      extension.exports.executeInREPL(blocks.join("\n"), {
        filename: editorUri ? editorUri.fsPath : 'code'
      });
    } else {
      window.showErrorMessage("Unable to execute code in Julia REPL");
    }
  },
};


const bashCellExecutor: VSCodeCellExecutor = {
  language: "bash",
  execute: async (blocks: string[]) => {
    const terminal = window.activeTerminal || window.createTerminal();
    terminal.show();
    terminal.sendText(blocks.join("\n"));
  }
};

const shCellExecutor = { ...bashCellExecutor, language: "sh" };

const shellCellExecutor = { ...bashCellExecutor, language: "shell" };

const kCellExecutors = [
  pythonCellExecutor, 
  rCellExecutor, 
  juliaCellExecutor, 
  bashCellExecutor, 
  shCellExecutor, 
  shellCellExecutor
];

function findExecutor(language: string) : VSCodeCellExecutor | undefined {
  return kCellExecutors.find((x) => x.language === language);
}

// ensure language extension is loaded (if required) by creating a
// virtual doc for the language (under the hood this triggers extension
// loading by sending a dummy hover-provider request)
const kLoadedLanguageExtensions: string[] = [];
export async function ensureRequiredExtension(language: string, silent?: boolean): Promise<boolean> {
  // only do this once per language
  if (kLoadedLanguageExtensions.includes(language)) {
    return true;
  }

  const executor = findExecutor(language);
  if (executor?.requiredExtension) {
    // validate the extension
    if (!validateRequiredExtension(executor, silent)) {
      return false;
    } else {
      // activate the extension if necessary
      const extension = extensions.getExtension(executor.requiredExtension[0]);
      if (extension) {
        if (!extension.isActive) {
          await extension.activate();
        }
        return true;
      } else {
        return false;
      }
    }
  } else {
    return false;
  }
}

function validateRequiredExtension(executor: VSCodeCellExecutor, silent = false) {
  if (executor.requiredExtension) {
    const extensionName = executor.requiredExtensionName;
    let extension: any;
    for (const reqExtension of executor.requiredExtension) {
      extension = extensions.getExtension(reqExtension);
      if (extension) {
        break;
      }
    }
    if (extension) {
      if (executor?.requiredVersion) {
        const version = (extension.packageJSON.version || "0.0.0") as string;
        if (semver.gte(version, executor.requiredVersion)) {
          return true;
        } else {
          if (!silent) {
            window.showWarningMessage(
              `Executing ${executor.language} cells requires v${executor.requiredVersion} of the ${extensionName} extension.`
            );
          }
          return false;
        }
      } else {
        return true;
      }
    } else {
      if (!silent) {
        window.showWarningMessage(
          `Executing ${executor.language} cells requires the ${extensionName} extension.`
        );
      }
      return false;
    }
  } else {
    return true;
  }
}