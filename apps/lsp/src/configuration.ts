/*
 * configuration.ts
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

import { Connection, DidChangeConfigurationNotification, Emitter } from 'vscode-languageserver';

import { Disposable } from 'core';
import { MathjaxSupportedExtension } from 'editor-types';

export type ValidateEnabled = 'ignore' | 'warning' | 'error' | 'hint';

export interface Settings {
	readonly workbench: {
		readonly colorTheme: string;
	};
	readonly quarto: {
		readonly path: string;
		readonly mathjax: {
			readonly scale: number;
			readonly extensions: MathjaxSupportedExtension[];
		}
	};
	readonly markdown: {
		readonly server: {
			readonly log: 'off' | 'debug' | 'trace';
		};

		readonly preferredMdPathExtensionStyle: 'auto' | 'includeExtension' | 'removeExtension';

		readonly occurrencesHighlight: {
			readonly enabled: boolean;
		};

		readonly suggest: {
			readonly paths: {
				readonly enabled: boolean;
				readonly includeWorkspaceHeaderCompletions: 'never' | 'onSingleOrDoubleHash' | 'onDoubleHash';
			};
		};

		readonly validate: {
			readonly enabled: true;
			readonly referenceLinks: {
				readonly enabled: ValidateEnabled;
			};
			readonly fragmentLinks: {
				readonly enabled: ValidateEnabled;
			};
			readonly fileLinks: {
				readonly enabled: ValidateEnabled;
				readonly markdownFragmentLinks: ValidateEnabled | 'inherit';
			};
			readonly ignoredLinks: readonly string[];
			readonly unusedLinkDefinitions: {
				readonly enabled: ValidateEnabled;
			};
			readonly duplicateLinkDefinitions: {
				readonly enabled: ValidateEnabled;
			};
		};
	};
}


export class ConfigurationManager extends Disposable {

	private readonly _onDidChangeConfiguration = this._register(new Emitter<Settings>());
	public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

	private _settings?: Settings;

	constructor() {
		super();
	}

	public async connect(connection: Connection) {

		// sync function
		const syncSettings = async () => {
			this._settings = await connection.workspace.getConfiguration();
			console.log("synced settings");
		}
		// sync now
		await syncSettings();

		// monitor changes
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
		connection.onDidChangeConfiguration(syncSettings);

		console.log("connected");
	}

	public getSettings(): Settings | undefined {
		return this._settings;
	}
}
