/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";

import { window, env, Uri } from "vscode";
import { QuartoContext } from "quarto-core";

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

export async function promptForQuartoInstallation(context: string) {
  const installQuarto = { title: "Install Quarto" };
  const result = await window.showWarningMessage(
    "Quarto Installation Not Found",
    {
      modal: true,
      detail: `Please install the Quarto CLI before ${context.toLowerCase()}.`,
    },
    installQuarto
  );
  if (result === installQuarto) {
    env.openExternal(Uri.parse("https://quarto.org/docs/get-started/"));
  }
}
