
/*
 * response.ts
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



export interface ResponseWithStatus<T> {
  status: number;
  headers: Headers | null;
  message: T | null;
  error: string;
}

export async function handleResponseWithStatus<T>(request: () => Promise<Response>) : Promise<ResponseWithStatus<T>> {
  try {
    const response = await request();
    if (response.ok) {
      return {
        status: 200,
        headers: response.headers,
        message: await response.json() as T,
        error: ''
      }
    } else {
      return {
        status: response.status,
        headers: response.headers,
        message: null,
        error: `${response.status} Error: ${response.statusText}`
      }
    } 
  } catch(error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return {
      status: message.includes("ENOTFOUND") ? 503 : 500,
      headers: null,
      message: null,
      error: message
    }
  }
}


