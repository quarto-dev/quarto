/*
 * promise.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

interface PendingPromise<T> {
  promise: () => Promise<T>;
  resolve: (result: T) => void;
  reject: (reason: unknown) => void;
}

export class PromiseQueue<T = unknown> {
  private queue = new Array<PendingPromise<T>>();
  private running = false;

  public enqueue(promise: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        promise,
        resolve,
        reject,
      });
      this.dequeue();
    });
  }

  private dequeue() {
    if (this.running) {
      return false;
    }
    const item = this.queue.shift();
    if (!item) {
      return false;
    }
    try {
      this.running = true;
      item
        .promise()
        .then(value => {
          this.running = false;
          item.resolve(value);
          this.dequeue();
        })
        .catch(err => {
          this.running = false;
          item.reject(err);
          this.dequeue();
        });
    } catch (err) {
      this.running = false;
      item.reject(err);
      this.dequeue();
    }
    return true;
  }
}
