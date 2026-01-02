/*
 * quarto.ts
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

import * as path from "node:path";
import * as fs from "node:fs";

import { window, env, workspace, Uri } from "vscode";
import { tryAcquirePositronApi } from "@posit-dev/positron";
import { QuartoContext, QuartoSource } from "quarto-core";
import { activePythonInterpreter, pythonIsCondaEnv, pythonIsVenv } from "./python";
import { isWindows } from "./platform";


import semver from "semver";


/**
 * Result of configuredQuartoPath including the path and source.
 */
export interface ConfiguredQuartoPathResult {
  path: string;
  source: QuartoSource;
}

/**
 * Searches for Quarto in VS Code-specific locations (settings, Positron bundled, pip/venv).
 *
 * @param logger Optional logger for verbose output
 * @returns The path and source if found, undefined otherwise
 */
export async function configuredQuartoPath(
  logger?: (msg: string) => void
): Promise<ConfiguredQuartoPathResult | undefined> {

  const config = workspace.getConfiguration("quarto");

  // explicitly configured trumps everything
  const quartoPath = config.get("path") as string | undefined;
  if (quartoPath) {
    logger?.(`  Checking quarto.path setting: ${quartoPath}`);
    return { path: quartoPath, source: "setting" };
  } else {
    logger?.("  Checking quarto.path setting: not configured");
  }

  // check if we should use bundled Quarto in Positron
  const useBundledQuarto = config.get("useBundledQuartoInPositron", false); // Default is now false
  const isPositron = tryAcquirePositronApi();

  if (useBundledQuarto) {
    logger?.("  Checking Positron bundled Quarto: enabled");

    if (isPositron) {
      // Use path relative to the application root for Positron's bundled Quarto
      const rootPath = env.appRoot; // Use vscode.env.appRoot as the application root path
      const positronQuartoPath = path.join(
        rootPath,
        "quarto",
        "bin",
        isWindows() ? "quarto.exe" : "quarto"
      );

      if (fs.existsSync(positronQuartoPath)) {
        logger?.(`  Found Positron bundled Quarto at ${positronQuartoPath}`);
        return { path: positronQuartoPath, source: "positron-bundled" };
      } else {
        // Log error when bundled Quarto can't be found
        logger?.(`  Positron bundled Quarto not found at ${positronQuartoPath}`);
        console.error(
          `useBundledQuartoInPositron is enabled but bundled Quarto not found at expected path: ${positronQuartoPath}. ` +
          `Verify Quarto is bundled in the Positron installation.`
        );

        window.showWarningMessage(
          "Unable to find bundled Quarto in Positron; falling back to system installation"
        );
      }
    } else {
      logger?.("  Not running in Positron, skipping bundled Quarto check");
    }
  } else {
    logger?.(`  Checking Positron bundled Quarto: disabled (useBundledQuartoInPositron = false)`);
  }

  // if we can use pip quarto then look for it within the currently python (if its a venv/condaenv)
  const usePipQuarto = config.get("usePipQuarto", true);
  if (usePipQuarto) {
    logger?.("  Checking pip-installed Quarto in Python venv/conda...");
    const python = await activePythonInterpreter();
    if (python) {
      if (pythonIsVenv(python) || pythonIsCondaEnv(python)) {
        // check if there is a quarto in the parent directory
        const binDir = path.dirname(python);
        const quartoPath = path.join(binDir, isWindows() ? "quarto.exe" : "quarto");
        if (fs.existsSync(quartoPath)) {
          logger?.(`  Found pip-installed Quarto at ${quartoPath}`);
          return { path: quartoPath, source: "pip-venv" };
        } else {
          logger?.(`  No Quarto found in Python environment at ${binDir}`);
        }
      } else {
        logger?.("  Active Python is not in a venv or conda environment");
      }
    } else {
      logger?.("  No active Python interpreter found");
    }
  } else {
    logger?.("  Checking pip-installed Quarto: disabled (usePipQuarto = false)");
  }

  return undefined;
}


export async function withMinimumQuartoVersion(
  context: QuartoContext,
  version: string,
  action: string,
  f: () => Promise<void>
) {
  if (context.available) {
    if (semver.gte(context.version, version)) {
      await f();
    } else {
      window.showWarningMessage(
        `${action} requires Quarto version ${version} or greater`,
        { modal: true }
      );
    }
  } else {
    await promptForQuartoInstallation(action);
  }
}

export async function promptForQuartoInstallation(context: string, modal = false) {
  const installQuarto = { title: "Install Quarto" };
  const detail = `Please install the Quarto CLI ${context}.`;
  const result = await window.showWarningMessage(
    "Quarto installation not found" + (!modal ? `. ${detail}` : ""),
    {
      modal,
      detail,
    },
    installQuarto
  );
  if (result === installQuarto) {
    env.openExternal(Uri.parse("https://quarto.org/docs/get-started/"));
  }
}
