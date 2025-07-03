/*
 * logging.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
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

/**
 * The level of verbosity that the language service logs at.
 */
export enum LogLevel {
  /** Disable logging */
  Off,

  /** Log verbose info about language server operation, such as when references are re-computed for a md file. */
  Debug,

  /** Log extremely verbose info about language server operation, such as calls into the file system */
  Trace,
}

/**
 * Logs debug messages from the language service
 */
export interface ILogger {
  /**
   * Get the current log level.
   */
  get level(): LogLevel;

  /**
   * Log a message at a given log level.
   *
   * @param level The level the message should be logged at.
   * @param message The main text of the log.
   * @param data Additional information about what is being logged.
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
}
