/*
 * preview-env.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Uri } from "vscode";

import { PreviewOutputSink } from "./preview-output";
import { TerminalEnv, terminalEnv } from "../../core/terminal";

export interface PreviewEnv extends TerminalEnv {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_LOG: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_RENDER_TOKEN: string;
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

    const env: PreviewEnv = {

      // eslint-disable-next-line @typescript-eslint/naming-convention
      QUARTO_LOG: this.outputFile_,

      // eslint-disable-next-line @typescript-eslint/naming-convention
      QUARTO_RENDER_TOKEN: this.renderToken_,

      ...(await terminalEnv(uri))

    };

    return env;
  }
  private readonly outputFile_: string;
}
