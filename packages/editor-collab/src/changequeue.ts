/*
 * changequeue.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
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


import { Change } from './automerge';

export class ChangeQueue {
  private changes: Array<Change> = [];
  private timer: number | undefined = undefined;

  /** Milliseconds between flushes. */
  private interval: number;

  /** Flush action. */
  private handleFlush: (changes: Array<Change>) => void;

  constructor({
    // Can tune this sync interval to simulate network latency,
    // make it easier to observe sync behavior, etc.
    interval = 10,
    handleFlush,
  }: {
    interval?: number;
    /** Flush action. */
    handleFlush: (changes: Array<Change>) => void;
  }) {
    this.interval = interval;
    this.handleFlush = handleFlush;
  }

  public enqueue(...changes: Array<Change>): void {
    this.changes.push(...changes);
  }

  /**
   * Flush all changes to the publisher. Runs on a timer.
   */
  flush = (): void => {
    // TODO: Add retry logic to capture failures.
    this.handleFlush(this.changes);
    this.changes = [];
  };

  public start(): void {
    this.timer = window.setInterval(this.flush, this.interval);
  }

  public drop(): void {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
    }
  }
}
