/*
 * event.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { Event } from "vscode";

export function filterEvent<T>(
  event: Event<T>,
  filter: (e: T) => boolean,
): Event<T> {
  return (listener, thisArgs?, disposables?) => {
    return event((e) => {
      if (filter(e)) {
        listener.call(thisArgs, e);
      }
    }, null, disposables);
  };
}

export function onceEvent<T>(event: Event<T>): Event<T> {
  return (listener, thisArgs?, disposables?) => {
    const result = event(e => {
      result.dispose();
      return listener.call(thisArgs, e);
    }, null, disposables);

    return result;
  };
}

export function debounceEvent<T>(event: Event<T>, delay: number): Event<T> {
  return (listener, thisArgs?, disposables?) => {
    let timer: NodeJS.Timeout;
    return event(e => {
      clearTimeout(timer);
      timer = setTimeout(() => listener.call(thisArgs, e), delay);
    }, null, disposables);
  };
}

export function eventToPromise<T>(event: Event<T>): Promise<T> {
  const once = onceEvent(event);
  return new Promise<T>(resolve => once(e => resolve(e)));
}
