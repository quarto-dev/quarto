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
import { TextDocument } from "vscode";
import { parseFrontMatterStr, partitionYamlFrontMatter } from "quarto-core";


export interface CellExecutor {
  execute: (document: TextDocument, blocks: string[]) => Promise<void>;
  executeSelection?: (document: TextDocument) => Promise<void>;
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
  execute: (document: TextDocument, blocks: string[]) => Promise<void>;
  executeSelection?: (document: TextDocument) => Promise<void>;
}

const pythonCellExecutor: VSCodeCellExecutor = {
  language: "python",
  requiredExtension: ["ms-python.python"],
  requiredExtensionName: "Python",
  requiredVersion: "2021.8.0",
  execute: async (_document: TextDocument, blocks: string[]) => {
    for (const block of blocks) {
      await commands.executeCommand("jupyter.execSelectionInteractive", block);
    }
  },
};

const rCellExecutor = () : VSCodeCellExecutor => {

  // re-read params if they have changed
  const executedParams = new Map<string, string>();
  const paramsBlock = (document: TextDocument) => {
    const partitioned = partitionYamlFrontMatter(document.getText());
    if (partitioned?.yaml && !document.isUntitled) {
      const yaml = parseFrontMatterStr(partitioned.yaml) as Record<string,unknown>;
      if (yaml && typeof yaml === "object") {
        if (yaml.params && typeof yaml.params === "object") {
          const params = JSON.stringify(yaml.params);
          const executed = executedParams.get(document.uri.toString());
          if (params !== executed) {
            executedParams.set(document.uri.toString(), params);
            return `params <- rmarkdown::yaml_front_matter("${document.uri.fsPath}")$params`;
          }
        }
      }
    }
    return undefined;
  };
  


  return {
    language: "r",
    requiredExtension: ["REditorSupport.r", "Ikuyadeu.r"],
    requiredExtensionName: "R",
    requiredVersion: "2.4.0",
    execute: async (document: TextDocument, blocks: string[]) => {
      // check for params
      const params = paramsBlock(document);
      if (params) {
        blocks = [params, ...blocks];
      }
      await commands.executeCommand("r.runSelection", blocks.join("\n").trim());
    },
    executeSelection: async (document: TextDocument) => {
      // check for params
      const params = paramsBlock(document);
      if (params) {
        await commands.executeCommand("r.runSelection", params);
      }
      await commands.executeCommand("r.runSelection");
    },
};
};

const juliaCellExecutor: VSCodeCellExecutor = {
  language: "julia",
  requiredExtension: ["julialang.language-julia"],
  requiredExtensionName: "Julia",
  requiredVersion: "1.4.0",
  execute: async (document: TextDocument, blocks: string[]) => {
    const editorUri = !document.isUntitled ? document.uri : undefined;
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
  execute: async (_document: TextDocument, blocks: string[]) => {
    const terminal = window.activeTerminal || window.createTerminal();
    terminal.show();
    terminal.sendText(blocks.join("\n"));
  }
};

const shCellExecutor = { ...bashCellExecutor, language: "sh" };

const shellCellExecutor = { ...bashCellExecutor, language: "shell" };

const kCellExecutors = [
  pythonCellExecutor, 
  rCellExecutor(), 
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