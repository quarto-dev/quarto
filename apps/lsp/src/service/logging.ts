/*
 * logging.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * The level of verbosity that the language service logs at.
 */
export enum LogLevel {
  /** Log extremely verbose info about language server operation, such as calls into the file system */
  Trace,

  /** Log verbose info about language server operation, such as when references are re-computed for a md file. */
  Debug,

  /** Informational messages that highlight the progress of the application at coarse-grained level. */
  Info,

  /** Potentially harmful situations which still allow the application to continue running. */
  Warn,

  /** Error events that might still allow the application to continue running. */
  Error,
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

  logTrace(message: string, data?: Record<string, unknown>): void;
  logDebug(message: string, data?: Record<string, unknown>): void;
  logInfo(message: string, data?: Record<string, unknown>): void;
  logWarn(message: string, data?: Record<string, unknown>): void;
  logError(message: string, data?: Record<string, unknown>): void;

  /**
   * Log notification at Trace level.
   * @param method Message type name.
   */
  logNotification(method: string, data?: Record<string, unknown>): void;

  /**
   * Log request at Trace level.
   * @param method Message type name.
   */
  logRequest(method: string, data?: Record<string, unknown>): void;
}
