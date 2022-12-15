/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as child_process from "child_process";

export function isRStudioWorkbench() {
  // RS_SERVER_URL e.g. https://daily-rsw.soleng.rstudioservices.com/
  // RS_SESSION_URL e.g. /s/eae053c9ab5a71168ee19/
  return process.env.RS_SERVER_URL && process.env.RS_SESSION_URL;
}

export function isVSCodeServer() {
  return !!vsCodeServerProxyUri();
}

export function vsCodeServerProxyUri() {
  return process.env.VSCODE_PROXY_URI;
}

export function vsCodeWebUrl(serverUrl: string) {
  const port = new URL(serverUrl).port;
  if (isRStudioWorkbench()) {
    return rswURL(port);
  } else if (isVSCodeServer()) {
    return vsCodeServerProxyUri()!.replace("{{port}}", `${port}`);
  } else {
    return serverUrl;
  }
}

export function rswURL(port: string) {
  const server = process.env.RS_SERVER_URL!;
  const session = process.env.RS_SESSION_URL!;
  const portToken = rswPortToken(port);
  const url = `${server}${session.slice(1)}p/${portToken}/`;
  return url;
}

function rswPortToken(port: string) {
  try {
    const result = child_process.execFileSync(
      "/usr/lib/rstudio-server/bin/rserver-url",
      [port],
      {
        encoding: "utf-8",
      }
    ) as unknown as string;
    return result;
  } catch (e) {
    throw new Error(`Failed to map RSW port token`);
  }
}
