/*
 * manager.ts
 *
 * Copyright (C) 2024 by Posit Software, PBC
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

import { Disposable } from 'vscode';
import { TaskCallback, TaskQueue } from './queue';

/**
 * Manager of multiple task queues
 * 
 * A singleton class that constructs and manages multiple `TaskQueue`s, identified by their `key`.
 */
export class TaskQueueManager implements Disposable {
  /// Singleton instance
  private static _instance: TaskQueueManager;

  /// Maps a `key` to its `queue`
  private _queues = new Map<string, TaskQueue>();

  /**
   * Constructor
   *
   * Private since we only want one of these per `key`. Access using `instance()` instead.
   */
  private constructor() { }

  /**
   * Accessor for the singleton instance
   *
   * Creates it if it doesn't exist.
   */
  static get instance(): TaskQueueManager {
    if (!TaskQueueManager._instance) {
      // Initialize manager if we've never accessed it
      TaskQueueManager._instance = new TaskQueueManager();
    }

    return TaskQueueManager._instance;
  }

  /**
   * Enqueue a `callback` for execution on `key`'s task queue
   * 
   * Returns a promise that resolves when the task finishes
   */
  async enqueue(key: string, callback: TaskCallback): Promise<void> {
    let queue = this._queues.get(key);

    if (queue === undefined) {
      // If we've never initialized this key's queue, do so now
      queue = new TaskQueue();
      this._queues.set(key, queue);
    }

    return queue.enqueue(callback);
  }

  /**
   * Disposal method
   * 
   * Never called in practice, because this is a singleton and effectively a global.
   */
  dispose(): void {
    this._queues.forEach((queue) => queue.dispose());
  }
}
