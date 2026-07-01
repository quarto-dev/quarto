/*
 * util.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 *
 *
 */

import { QueryReturnValue } from "@reduxjs/toolkit/dist/query/baseQueryTypes";
import { BaseQueryFn } from "@reduxjs/toolkit/dist/query/react";
import { JsonRpcError } from "core";

// workaround for type errors when using built-in fakeBaseQuery:
// https://github.com/reduxjs/redux-toolkit/issues/2314
export function rtkFakeBaseQuery<ErrorType>(): BaseQueryFn<
  void,
  never,
  ErrorType,
  unknown
> {
  return function () {
    throw new Error(
      "When using `fakeBaseQuery`, all queries & mutations must use the `queryFn` definition syntax."
    );
  };
}

export async function rtkHandleQuery<T>(promise: Promise<T>) : Promise<QueryReturnValue<T,JsonRpcError>> {
  return promise
    .then((value: T) => {
      return { data: value };
    })
    .catch((error: JsonRpcError) => {
      return { error };
    })
}
