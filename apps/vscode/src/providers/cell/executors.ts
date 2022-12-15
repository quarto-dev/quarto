/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: implement some terminal based executors
// (e.g. see https://github.com/JeepShen/vscode-markdown-code-runner)

import semver from "semver";

import Token from "markdown-it/lib/token";
import { commands, extensions, Position, TextDocument, window } from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isExecutableLanguageBlock,
  isExecutableLanguageBlockOf,
  languageNameFromBlock,
} from "../../markdown/language";
import { virtualDoc, virtualDocUri } from "../../vdoc/vdoc";
import { lines } from "../../core/text";
import { cellOptions, kExecuteEval } from "./options";

export function hasExecutor(language: string) {
  return !!kCellExecutors.find((x) => x.language === language);
}

export function blockHasExecutor(token?: Token) {
  if (token) {
    const language = languageNameFromBlock(token);
    return isExecutableLanguageBlock(token) && hasExecutor(language);
  } else {
    return false;
  }
}

export function blockIsExecutable(token?: Token) {
  if (token) {
    return (
      blockHasExecutor(token) && cellOptions(token)[kExecuteEval] !== false
    );
  } else {
    return false;
  }
}

// skip yaml options for execution
export function codeFromBlock(token: Token) {
  const language = languageNameFromBlock(token);
  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor) {
    const blockLines = lines(token.content);
    const startCodePos = blockLines.findIndex(
      (line) => !executor.isYamlOption(line)
    );
    if (startCodePos !== -1) {
      return blockLines.slice(startCodePos).join("\n");
    } else {
      return "";
    }
  } else {
    return token.content;
  }
}

export async function executeInteractive(
  language: string,
  blocks: string[]
): Promise<void> {
  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor) {
    return await executor.execute(blocks);
  }
}

// attempt language aware execution of current selection (returns false
// if the executor doesn't support this, in which case generic
// executeInteractive will be called)
export async function executeSelectionInteractive(language: string) {
  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor?.executeSelection) {
    await executor.executeSelection();
    return true;
  } else {
    return false;
  }
}

export function hasCellExecutor(language: string) {
  return !!kCellExecutors.find((x) => x.language === language);
}

export function hasRequiredExtension(language: string) {
  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor) {
    return validateRequiredExtension(executor, true);
  } else {
    return false;
  }
}

// ensure language extension is loaded (if required) by creating a
// virtual doc for the language (under the hood this triggers extension
// loading by sending a dummy hover-provider request)
const kLoadedLanguageExtensions: string[] = [];
export async function ensureRequiredExtension(
  language: string,
  document: TextDocument,
  engine: MarkdownEngine
): Promise<boolean> {
  // only do this once per language
  if (kLoadedLanguageExtensions.includes(language)) {
    return true;
  }

  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor) {
    // validate the extension
    if (!validateRequiredExtension(executor)) {
      return false;
    }

    // load a virtual doc for this file (forces extension to load)
    const tokens = await engine.parse(document);
    const languageBlock = tokens.find(isExecutableLanguageBlockOf(language));
    if (languageBlock?.map) {
      const vdoc = await virtualDoc(
        document,
        new Position(languageBlock.map[0] + 1, 0),
        engine
      );
      if (vdoc) {
        // get the virtual doc
        await virtualDocUri(vdoc, document.uri);

        // mark language as being loaded
        kLoadedLanguageExtensions.push(executor.language);

        // success!!
        return true;
      }
    }
  }

  //  unable to validate
  return false;
}

function validateRequiredExtension(executor: CellExecutor, silent = false) {
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

interface CellExecutor {
  language: string;
  requiredExtensionName: string;
  requiredExtension?: string[];
  requiredVersion?: string;
  isYamlOption: (line: string) => boolean;
  execute: (blocks: string[]) => Promise<void>;
  executeSelection?: () => Promise<void>;
}

const pythonCellExecutor: CellExecutor = {
  language: "python",
  requiredExtension: ["ms-python.python"],
  requiredExtensionName: "Python",
  requiredVersion: "2021.8.0",
  isYamlOption: isYamlHashOption,
  execute: async (blocks: string[]) => {
    for (const block of blocks) {
      await commands.executeCommand("jupyter.execSelectionInteractive", block);
    }
  },
};

const rCellExecutor: CellExecutor = {
  language: "r",
  requiredExtension: ["REditorSupport.r", "Ikuyadeu.r"],
  requiredExtensionName: "R",
  requiredVersion: "2.4.0",
  isYamlOption: isYamlHashOption,
  execute: async (blocks: string[]) => {
    await commands.executeCommand("r.runSelection", blocks.join("\n").trim());
  },
  executeSelection: async () => {
    await commands.executeCommand("r.runSelection");
  },
};

const juliaCellExecutor: CellExecutor = {
  language: "julia",
  requiredExtension: ["julialang.language-julia"],
  requiredExtensionName: "Julia",
  requiredVersion: "1.4.0",
  isYamlOption: isYamlHashOption,
  execute: async (blocks: string[]) => {
    const extension = extensions.getExtension("julialang.language-julia");
    if (extension) {
      if (!extension.isActive) {
        await extension.activate();
      }
      extension.exports.executeInREPL(blocks.join("\n"), {});
    } else {
      window.showErrorMessage("Unable to execute code in Julia REPL");
    }
  },
};

function isYamlHashOption(line: string) {
  return !!line.match(/^#\s*\| ?/);
}

const kCellExecutors = [pythonCellExecutor, rCellExecutor, juliaCellExecutor];
