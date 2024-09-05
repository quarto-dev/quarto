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

/**
 * A task queue that maintains the ordering of tasks submitted to the queue
 */
export class TaskQueue implements Disposable {
  private _id: TaskId = 0;
  private _tasks: Task[] = [];
  private _running = false;

  private readonly _onDidFinishTask = new EventEmitter<TaskId>();
  private readonly onDidFinishTask = this._onDidFinishTask.event;

  dispose(): void {
    this._onDidFinishTask.dispose();
  }

  /**
   * Enqueue a `callback` for execution
   * 
   * Returns a promise that resolves when the task finishes
   */
  async enqueue(callback: TaskCallback): Promise<void> {
    // Create an official task out of this callback
    const task = this.task(callback);

    // Create a promise that resolves when the task is done
    const out = new Promise<void>((resolve, _reject) => {
      const handle = this.onDidFinishTask((id) => {
        if (task.id === id) {
          handle.dispose();
          resolve();
        }
      });
    });

    // Put the task on the back of the queue.
    // Immediately run it if possible.
    this._tasks.push(task);
    this.run();

    return out;
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

    // Pop off the first task in the queue
    const task = this._tasks.shift();

    if (task === undefined) {
      // Nothing to run right now
      return;
    }

    this._running = true;

    try {
      await task.callback();
    } finally {
      this._running = false;
      // Let the promise know this task is done
      this._onDidFinishTask.fire(task.id);
    }

    // Run next task if one is in the queue
    this.run();
  }

  /**
   * Construct a new `Task` that can be pushed onto the queue
   */
  private task(callback: TaskCallback): Task {
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
}
