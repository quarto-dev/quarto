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
    this.log(LogLevel.Debug, 'LSP is now connected');
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
      case 'off':
      default:
        return LogLevel.Off;
    }
  }

  get level(): LogLevel { return this._logLevel; }

  public log(level: LogLevel, message: string, data?: unknown): void {
    if (this.level < level) {
      return;
    }

    this.appendLine(`[lsp-${this.toLevelLabel(level)}] ${message}`);
    if (data) {
      this.appendLine(LogFunctionLogger.data2String(data));
    }
  }

  public logNotification(method: string) {
    this.log(LogLevel.Trace, `Got notification: '${method}'`);
  }

  public logRequest(method: string) {
    this.log(LogLevel.Trace, `Got request: '${method}'`);
  }

  private toLevelLabel(level: LogLevel): string {
    switch (level) {
      case LogLevel.Off: return 'off';
      case LogLevel.Debug: return 'debug';
      case LogLevel.Trace: return 'trace';
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
