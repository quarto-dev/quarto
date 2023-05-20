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

import { ConfigurationManager } from './configuration';

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

	constructor(
		private readonly _logFn: typeof console.log,
		private readonly _config: ConfigurationManager,
	) {
		super();

		this._register(this._config.onDidChangeConfiguration(() => {
			this._logLevel = LogFunctionLogger.readLogLevel(this._config);
		}));

		this._logLevel = LogFunctionLogger.readLogLevel(this._config);
	}

	private static readLogLevel(config: ConfigurationManager): LogLevel {
		switch (config.getSettings()?.markdown.server.log) {
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

		this.appendLine(`[${this.toLevelLabel(level)} ${LogFunctionLogger.now()}] ${message}`);
		if (data) {
			this.appendLine(LogFunctionLogger.data2String(data));
		}
	}

	private toLevelLabel(level: LogLevel): string {
		switch (level) {
			case LogLevel.Off: return 'Off';
			case LogLevel.Debug: return 'Debug';
			case LogLevel.Trace: return 'Trace';
		}
	}

	private appendLine(value: string): void {
		this._logFn(value);
	}
}

