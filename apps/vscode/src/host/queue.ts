/*
 * queue.ts
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

import { Disposable, EventEmitter } from 'vscode';

export type TaskId = number;
export type TaskCallback = () => Promise<void>;

export interface Task {
  id: TaskId,
  callback: TaskCallback
}

export class TaskQueue implements Disposable {
  /// Singleton instance
  private static _instance: TaskQueue;

  private _id: TaskId = 0;
  private _tasks: Task[] = [];
  private _running = false;

  private readonly _onDidFinishTask = new EventEmitter<TaskId>();
  onDidFinishTask = this._onDidFinishTask.event;

  /**
   * Disposal method
   *
   * Not currently used since the singleton is effectively a global variable.
   */
  dispose(): void {
    this._onDidFinishTask.dispose();
  }

  /**
   * Constructor
   *
   * Private since we only want one of these. Access using `instance()` instead.
   */
  private constructor() { }

  /**
   * Accessor for the singleton instance
   *
   * Creates it if it doesn't exist.
   */
  static get instance(): TaskQueue {
    if (!TaskQueue._instance) {
      TaskQueue._instance = new TaskQueue();
    }
    return TaskQueue._instance;
  }

  /**
   * Construct a new `Task` that can be pushed onto the queue
   */
  task(callback: TaskCallback): Task {
    const id = this.id();
    return { id, callback }
  }

  /**
   * Retrives an `id` to be used with the next task
   */
  private id(): TaskId {
    let id = this._id;
    this._id++;
    return id;
  }

  /**
   * Pushes a `task` into the queue. Immediately runs it if nothing else is running.
   */
  async push(task: Task) {
    this._tasks.push(task);

    // Immediately run the task if possible
    this.run();
  }

  /**
   * Runs a task in the queue
   *
   * If we are currently running something else, bails. `run()` will be called again
   * once the other task finishes.
   */
  private async run() {
    if (this._running) {
      // Someone else is running, we will get recalled once they finish
      return;
    }

    const task = this._tasks.pop();

    if (task === undefined) {
      // Nothing to run right now
      return;
    }

    this._running = true;

    try {
      await task.callback();
    } finally {
      this._running = false;
      this._onDidFinishTask.fire(task.id);
    }

    // Run next task if one is in the queue
    this.run();
  }
}
