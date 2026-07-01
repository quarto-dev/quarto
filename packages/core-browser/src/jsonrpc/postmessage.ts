/*
 * postmessage.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { JsonRpcPostMessageTarget } from "core";

export function windowJsonRpcPostMessageTarget(
  receiver: { postMessage: (data: unknown) => void | boolean } | Window, 
  source: Window
) : JsonRpcPostMessageTarget {
  if (receiver instanceof Window) {
    const windowReceiver = receiver;
    receiver = {
      postMessage: (data: unknown) => {
        windowReceiver.postMessage(data, { targetOrigin: "*" });
      }
    }
  }
  return {
    postMessage: (data: unknown) => {
      receiver.postMessage(data);
    },
    onMessage: (handler: (ev: MessageEvent) => void) => {
      const onMessage = (ev: MessageEvent) => {
        handler(ev.data);
      };
      source.addEventListener('message', onMessage);
      return () => {
        source.removeEventListener('message', onMessage);
      }
    }
  }
}
