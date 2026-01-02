/*
 * context.ts
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


import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ExecFileSyncOptions } from "node:child_process";
import * as semver from "semver";
import { execProgram, isArm_64 } from "core-node";

/**
 * Describes where Quarto was discovered from.
 */
export type QuartoSource =
  | "setting"           // quarto.path setting
  | "positron-bundled"  // Positron's bundled Quarto
  | "pip-venv"          // pip-installed in venv/conda
  | "path"              // Found on system PATH
  | "known-location"    // Known install location
  | "additional-path";  // Additional search path (Positron fallback)

/**
 * Get a human-readable description of the Quarto source for logging.
 */
export function getSourceDescription(source: QuartoSource | undefined): string {
  switch (source) {
    case "setting":
      return " (configured via quarto.path setting)";
    case "positron-bundled":
      return " (Positron bundled)";
    case "pip-venv":
      return " (pip-installed in Python environment)";
    case "path":
      return " (found on system PATH)";
    case "known-location":
      return " (found in known installation location)";
    case "additional-path":
      return " (found in additional search path)";
    default:
      return "";
  }
}

export interface QuartoContext {
  available: boolean;
  version: string;
  binPath: string;
  resourcePath: string;
  pandocPath: string;
  workspaceDir?: string;
  useCmd: boolean;
  source?: QuartoSource;
  runQuarto: (options: ExecFileSyncOptions, ...args: string[]) => string;
  runPandoc: (options: ExecFileSyncOptions, ...args: string[]) => string;
}

/**
 * Initialize a Quarto context.
 *
 * @param quartoPath A path to a user-specified Quarto executable. If
 *  supplied, this will be used in preference to other methods of detecting
 *  Quarto.
 * @param workspaceFolder The workspace folder to use for resolving relative
 *  paths.
 * @param additionalSearchPaths Additional paths to search for Quarto. These will only be used if
 *  Quarto is not found in the default locations or the system path.
 * @param showWarning A function to call to show a warning message.
 *
 * @returns A Quarto context.
 */
export function initQuartoContext(
  quartoPath?: string,
  workspaceFolder?: string,
  additionalSearchPaths?: string[],
  showWarning?: (msg: string) => void,
  options?: { logger?: (msg: string) => void; source?: QuartoSource }
): QuartoContext {
  // default warning to log
  showWarning = showWarning || console.log;
  const logger = options?.logger;
  let source = options?.source;

  // check for user setting (resolving workspace relative paths)
  let quartoInstall: QuartoInstallation | undefined;
  if (quartoPath) {
    if (!path.isAbsolute(quartoPath) && workspaceFolder) {
      quartoPath = path.join(workspaceFolder, quartoPath);
    }
    quartoInstall = detectUserSpecifiedQuarto(quartoPath, showWarning);
    // If a source wasn't provided and we have a path, assume it's from a setting
    if (quartoInstall && !source) {
      source = "setting";
    }
  }

  // next look on the path
  if (!quartoInstall) {
    logger?.("  Checking system PATH...");
    quartoInstall = detectQuarto("quarto");
    if (quartoInstall) {
      logger?.(`  Found Quarto ${quartoInstall.version} on system PATH`);
      source = "path";
    } else {
      logger?.("  Not found on system PATH");
    }
  }

  // if still not found, scan for versions of quarto in known locations
  if (!quartoInstall) {
    logger?.("  Scanning known installation locations...");
    const result = scanForQuartoWithSource(additionalSearchPaths, logger);
    quartoInstall = result.install;
    if (result.install) {
      source = result.source;
    }
  }

  // return if we got them
  if (quartoInstall) {
    // use cmd suffix for older versions of quarto on windows
    const windows = os.platform() == "win32";
    const useCmd = windows && semver.lte(quartoInstall.version, "1.1.162");
    let pandocPath = process.env["QUARTO_PANDOC"] || path.join(quartoInstall!.binPath, "tools", "pandoc");
    // more recent versions of quarto use architecture-specific tools dir,
    // if the pandocPath is not found then look in the requisite dir for this arch
    if (!windows && !fs.existsSync(pandocPath)) {
      pandocPath = path.join(
        path.dirname(pandocPath),
        isArm_64() ? "aarch64" : "x86_64",
        path.basename(pandocPath)
      );
    }
    return {
      available: true,
      ...quartoInstall,
      pandocPath,
      workspaceDir: workspaceFolder,
      useCmd,
      source,
      runQuarto: (options: ExecFileSyncOptions, ...args: string[]) =>
        execProgram(
          path.join(quartoInstall!.binPath, "quarto" + (useCmd ? ".cmd" : "")),
          args,
          options
        ),
      runPandoc: (options: ExecFileSyncOptions, ...args: string[]) =>
        execProgram(
          pandocPath,
          args,
          options
        ),
    };
  } else {
    logger?.("  Quarto CLI not found");
    return quartoContextUnavailable();
  }
}

export function quartoContextUnavailable(): QuartoContext {
  return {
    available: false,
    version: "",
    binPath: "",
    resourcePath: "",
    pandocPath: "",
    useCmd: false,
    runQuarto: () => "",
    runPandoc: () => "",
  };
}

type QuartoInstallation = {
  version: string;
  binPath: string;
  resourcePath: string;
};

function detectQuarto(quartoPath: string): QuartoInstallation | undefined {
  // detect version and paths (fall back to .cmd on windows if necessary)
  const windows = os.platform() == "win32";
  let version: string | undefined;
  let paths: string[] | undefined;
  const readQuartoInfo = (bin: string) => {
    version = execProgram(bin, ["--version"]);
    paths = execProgram(bin, ["--paths"]).split(/\r?\n/);
  };
  try {
    readQuartoInfo(quartoPath);
  } catch (e) {
    if (windows) {
      try {
        readQuartoInfo(quartoPath + ".cmd");
      } catch (e) { /* */ }
    }
  }
  // return version if we have it
  if (version && paths) {
    return {
      version,
      binPath: paths[0],
      resourcePath: paths[1],
    };
  } else {
    return undefined;
  }
}

function detectUserSpecifiedQuarto(
  quartoPath: string,
  showWarning: (msg: string) => void
): QuartoInstallation | undefined {
  // validate that it exists
  if (!fs.existsSync(quartoPath)) {
    showWarning(
      "Unable to find specified quarto executable: '" + quartoPath + "'"
    );
    return undefined;
  }

  // validate that it is a file
  if (!fs.statSync(quartoPath).isFile()) {
    showWarning(
      "Specified quarto executable is a directory not a file: '" +
      quartoPath +
      "'"
    );
    return undefined;
  }

  // detect
  return detectQuarto(quartoPath);
}

/**
 * Scan for Quarto in known locations, returning the source.
 *
 * @param additionalSearchPaths Additional paths to search for Quarto (optional)
 * @param logger Optional logger for verbose output
 *
 * @returns An object containing the installation (if found) and the source
 */
function scanForQuartoWithSource(
  additionalSearchPaths?: string[],
  logger?: (msg: string) => void
): { install: QuartoInstallation | undefined; source: QuartoSource | undefined } {
  const knownPaths: string[] = [];
  if (os.platform() === "win32") {
    knownPaths.push("C:\\Program Files\\Quarto\\bin");
    const localAppData = process.env["LOCALAPPDATA"];
    if (localAppData) {
      knownPaths.push(path.join(localAppData, "Programs", "Quarto", "bin"));
    }
    knownPaths.push("C:\\Program Files\\RStudio\\bin\\quarto\\bin");
  } else if (os.platform() === "darwin") {
    knownPaths.push("/Applications/quarto/bin");
    const home = process.env.HOME;
    if (home) {
      knownPaths.push(path.join(home, "Applications", "quarto", "bin"));
    }
    knownPaths.push("/Applications/RStudio.app/Contents/MacOS/quarto/bin");
  } else if (os.platform() === "linux") {
    knownPaths.push("/opt/quarto/bin");
    knownPaths.push("/usr/lib/rstudio/bin/quarto/bin");
    knownPaths.push("/usr/lib/rstudio-server/bin/quarto/bin");
  }

  // Check known locations first
  for (const scanPath of knownPaths.filter(fs.existsSync)) {
    const install = detectQuarto(path.join(scanPath, "quarto"));
    if (install) {
      logger?.(`  Found Quarto ${install.version} at ${scanPath}`);
      return { install, source: "known-location" };
    }
  }

  // Then check additional search paths (e.g., Positron bundled location)
  if (additionalSearchPaths) {
    for (const scanPath of additionalSearchPaths.filter(fs.existsSync)) {
      const install = detectQuarto(path.join(scanPath, "quarto"));
      if (install) {
        logger?.(`  Found Quarto ${install.version} at ${scanPath} (additional search path)`);
        return { install, source: "additional-path" };
      }
    }
  }

  logger?.("  Not found in known installation locations");
  return { install: undefined, source: undefined };
}
