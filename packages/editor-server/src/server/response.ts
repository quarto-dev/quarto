/*
 * response.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { kStatusError, kStatusNoHost, kStatusNotFound, kStatusOK } from "editor-types";

// datacite, doi, and pubmed all share a common response type pattern that includes
// status and optional message and error payloads -- this function provides a common
// implementation for handling these requests

export interface ResponseWithStatus<T> {
  status: typeof kStatusOK | typeof kStatusNotFound | typeof kStatusNoHost | typeof kStatusError;
  message: T | null;
  error: string;
}

export async function handleResponseWithStatus<T>(request: () => Promise<Response>) : Promise<ResponseWithStatus<T>> {
  try {
    const response = await request();
    if (response.ok) {
      return {
        status: kStatusOK,
        message: await response.json() as T,
        error: ''
      }
    } else if (response.status === 404) {
      return {
        status: kStatusNotFound,
        message: null,
        error: ''
      }
    } else {
      return {
        status: kStatusError,
        message: null,
        error: `${response.status} Error: ${response.statusText}`
      }
    }
  } catch(error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return {
      status: message.includes("ENOTFOUND") ? kStatusNoHost : kStatusError,
      message: null,
      error: message
    }
  }
}


