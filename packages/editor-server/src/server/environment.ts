/*
 * environment.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { JsonRpcServerMethod } from "core";
import { EnvironmentServer, kEnvironmentGetRPackageCitations, kEnvironmentGetRPackageState, RPackageCitation, RPackageState } from "editor-types";

export function environmentServer() : EnvironmentServer {
  return {
    getRPackageState() : Promise<RPackageState> {
      throw new Error("not implemented");
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getRPackageCitations(pkgName: string) : Promise<RPackageCitation[]> {
      throw new Error("not implemented");
    }
  };
}

export function environmentServerMethods() : Record<string, JsonRpcServerMethod> {
  const server = environmentServer();
  const methods: Record<string, JsonRpcServerMethod> = {
    [kEnvironmentGetRPackageState]: () => server.getRPackageState(),
    [kEnvironmentGetRPackageCitations]: args => server.getRPackageCitations(args[0])
  }
  return methods;
}

