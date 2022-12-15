/*
 * preview-env.ts
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

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as child_process from "child_process";

import { extensions, Uri, workspace } from "vscode";

import { PreviewOutputSink } from "./preview-output";
import { shQuote } from "core";
import { dirname } from "../../core/path";

export interface PreviewEnv {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_LOG: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_RENDER_TOKEN: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_PYTHON?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_R?: string;
}

export function requiresTerminalDelay(env?: PreviewEnv) {
  try {
    if (env?.QUARTO_PYTHON) {
      // look for virtualenv
      const binDir = dirname(env.QUARTO_PYTHON);
      const venvFiles = ["activate", "pyvenv.cfg", "../pyvenv.cfg"];
      if (
        venvFiles.map((file) => path.join(binDir, file)).some(fs.existsSync)
      ) {
        return true;
      }

      // look for conda env
      const args = [
        "-c",
        "import sys, os; print(os.path.exists(os.path.join(sys.prefix, 'conda-meta')))",
      ];
      const output = (
        child_process.execFileSync(shQuote(env.QUARTO_PYTHON), args, {
          encoding: "utf-8",
        }) as unknown as string
      ).trim();
      return output === "True";
    } else {
      return false;
    }
  } catch (err) {
    console.error(err);
    return false;
  }
}

export function previewEnvsEqual(a?: PreviewEnv, b?: PreviewEnv) {
  return (
    a !== undefined &&
    b !== undefined &&
    a?.QUARTO_LOG === b?.QUARTO_LOG &&
    a?.QUARTO_RENDER_TOKEN === b?.QUARTO_RENDER_TOKEN &&
    a?.QUARTO_PYTHON === b?.QUARTO_PYTHON &&
    a?.QUARTO_R === b?.QUARTO_R
  );
}

export class PreviewEnvManager {
  constructor(
    outputSink: PreviewOutputSink,
    private readonly renderToken_: string
  ) {
    this.outputFile_ = outputSink.outputFile();
  }

  public async previewEnv(uri: Uri) {
    // get workspace for uri (if any)
    const workspaceFolder = workspace.getWorkspaceFolder(uri);

    // base env
    const env: PreviewEnv = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      QUARTO_LOG: this.outputFile_, QUARTO_RENDER_TOKEN: this.renderToken_,
    };
    // QUARTO_PYTHON
    const pyExtension = extensions.getExtension("ms-python.python");
    if (pyExtension) {
      if (!pyExtension.isActive) {
        await pyExtension.activate();
      }

      const execDetails = pyExtension.exports.settings.getExecutionDetails(
        workspaceFolder?.uri
      );
      if (Array.isArray(execDetails?.execCommand)) {
        env.QUARTO_PYTHON = execDetails.execCommand[0];
      }
    }

    // QUARTO_R
    const rExtension =
      extensions.getExtension("REditorSupport.r") ||
      extensions.getExtension("Ikuyadeu.r");
    if (rExtension) {
      const rPath = workspace.getConfiguration("r.rpath", workspaceFolder?.uri);
      let quartoR: string | undefined;
      switch (os.platform()) {
        case "win32": {
          quartoR = rPath.get("windows");
          break;
        }
        case "darwin": {
          quartoR = rPath.get("mac");
          break;
        }
        case "linux": {
          quartoR = rPath.get("linux");
          break;
        }
      }
      if (quartoR) {
        env.QUARTO_R = quartoR;
      }
    }

    return env;
  }
  private readonly outputFile_: string;
}
