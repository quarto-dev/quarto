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

// based on:
// https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/server/src/logging.ts


import { Disposable } from 'core';

import { ILogger, LogLevel } from "./service";

import { ConfigurationManager } from './config';
import { Connection } from 'vscode-languageserver';

export class LogFunctionLogger extends Disposable implements ILogger {

  private static now(): string {
    const now = new Date();
    return String(now.getUTCHours()).padStart(2, '0')
      + ':' + String(now.getMinutes()).padStart(2, '0')
      + ':' + String(now.getUTCSeconds()).padStart(2, '0') + '.' + String(now.getMilliseconds()).padStart(3, '0');
  }

  private static data2String(data: unknown): string {
    if (data instanceof Error) {
      if (typeof data.stack === 'string') {
        return data.stack;
      }
      return data.message;
    }
    if (typeof data === 'string') {
      return data;
    }
    return JSON.stringify(data, undefined, 2);
  }

  private _logLevel: LogLevel;
  private _connection?: Connection;
  private _config?: ConfigurationManager;

  constructor(
    private readonly _logFn: typeof console.log,
  ) {
    super();

    // Be verbose during init until we have a chance to get the user configuration
    this._logLevel = LogLevel.Debug;
  }

  setConnection(connection: Connection) {
    this._connection = connection;
    this.logInfo('LSP is now connected');
  }

  setConfigurationManager(config: ConfigurationManager) {
    this._config = config;

    this._register(this._config.onDidChangeConfiguration(() => {
      this._logLevel = LogFunctionLogger.currentLogLevel(this._config!);
    }));

    this._logLevel = LogFunctionLogger.currentLogLevel(this._config);
  }

  private static currentLogLevel(config: ConfigurationManager): LogLevel {
    return config.getSettings().quarto.logLevel;
  }

  public static parseLogLevel(logLevel: string): LogLevel {
    switch (logLevel) {
      case 'trace': return LogLevel.Trace;
      case 'debug': return LogLevel.Debug;
      case 'info': return LogLevel.Info;
      case 'warn': return LogLevel.Warn;
      case 'error': return LogLevel.Error;
      default:
        return LogLevel.Warn;
    }
  }

  get level(): LogLevel { return this._logLevel; }

  public log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) {
      return;
    }

    this.appendLine(`[lsp-${this.toLevelLabel(level)}] ${message}`);
    if (data) {
      this.appendLine(LogFunctionLogger.data2String(data));
    }
  }

  public logTrace(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Trace, message, data);
  }
  public logDebug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Debug, message, data);
  }
  public logInfo(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Info, message, data);
  }
  public logWarn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Warn, message, data);
  }
  public logError(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Error, message, data);
  }

  public logNotification(method: string, data?: Record<string, unknown>) {
    this.logTrace(`Got notification: '${method}'`, data);
  }
  public logRequest(method: string, data?: Record<string, unknown>) {
    this.logTrace(`Got request: '${method}'`, data);
  }

  private toLevelLabel(level: LogLevel): string {
    switch (level) {
      case LogLevel.Trace: return 'trace';
      case LogLevel.Debug: return 'debug';
      case LogLevel.Info: return 'info';
      case LogLevel.Warn: return 'warn';
      case LogLevel.Error: return 'error';
    }
  }

  private appendLine(value: string): void {
    // If we're connected, send log messages to client as LSP notifications
    if (this._connection) {
      this._connection.console.log(value);
    } else {
      this._logFn(value);
    }
  }
}
