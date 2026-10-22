/*
 * util.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 *
 *
 */

import type { QueryReturnValue } from "@reduxjs/toolkit/query";
import { JsonRpcError } from "core";

export async function rtkHandleQuery<T>(promise: Promise<T>) : Promise<QueryReturnValue<T, JsonRpcError, undefined>> {
  return promise
    .then((value: T) => {
      return { data: value };
    })
    .catch((error: JsonRpcError) => {
      return { error };
    })
}
