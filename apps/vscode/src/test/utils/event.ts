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
