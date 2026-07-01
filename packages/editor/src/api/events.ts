/*
 * events.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorEvents, EventHandler, EventType } from "./event-types";


/**
 * Creates a new type of event. Use the TDetail type parameter to indicate the
 * type of data, if any, that event handlers can expect.
 */
export function makeEventType<TDetail = void>(eventName: string) {
  return { eventName: `panmirror${eventName}` } as EventType<TDetail>;
}

/**
 * An implementation of EditorEvents, using the DOM event system.
 */
export class DOMEditorEvents implements EditorEvents {
  private readonly el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  public emit<TDetail>(eventType: EventType<TDetail>, detail?: TDetail) {
    // Note: CustomEvent requires polyfill for IE, see
    // https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent
    const event = new CustomEvent(eventType.eventName, { detail });
    return this.el.dispatchEvent(event);
  }

  public subscribe<TDetail>(eventType: EventType<TDetail>, handler: EventHandler<TDetail>) {
    const listener = function(this: unknown, evt: Event) {
      const detail: TDetail | undefined = (evt as CustomEvent).detail;
      handler.call(this, detail);
    };
    this.el.addEventListener(eventType.eventName, listener);
    return () => {
      this.el.removeEventListener(eventType.eventName, listener);
    };
  }
}
