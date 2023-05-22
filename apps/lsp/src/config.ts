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
import { 
	DiagnosticLevel, 
	DiagnosticOptions, 
	IncludeWorkspaceHeaderCompletions,
	LsConfiguration,
	defaultLsConfiguration,
	PreferredMdPathExtensionStyle
} from './service';

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

		// function to update settings
		const updateSettings = async () => {
			this._settings = await connection.workspace.getConfiguration();
			this._onDidChangeConfiguration.fire(this._settings!);
		}

		// start with currnent settings
		await updateSettings();
		
		// monitor changes
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
		connection.onDidChangeConfiguration(() => {
			updateSettings();
		});
	}

	public getSettings(): Settings | undefined {
		return this._settings;
	}
}

export function lsConfiguration(configurationManager: ConfigurationManager) : LsConfiguration {
	const config = defaultLsConfiguration();
	return {
		...config,
		get preferredMdPathExtensionStyle() {
			switch (configurationManager.getSettings()?.markdown.preferredMdPathExtensionStyle) {
				case 'includeExtension': return PreferredMdPathExtensionStyle.includeExtension;
				case 'removeExtension': return PreferredMdPathExtensionStyle.removeExtension;
				case 'auto':
				default:
					return PreferredMdPathExtensionStyle.auto;
			}
		},
		get includeWorkspaceHeaderCompletions() : IncludeWorkspaceHeaderCompletions {
			switch (configurationManager.getSettings()?.markdown.suggest.paths.includeWorkspaceHeaderCompletions || config.includeWorkspaceHeaderCompletions) {
				case 'onSingleOrDoubleHash': return IncludeWorkspaceHeaderCompletions.onSingleOrDoubleHash;
				case 'onDoubleHash': return IncludeWorkspaceHeaderCompletions.onDoubleHash;
				case 'never':
				default: return IncludeWorkspaceHeaderCompletions.never;
			}
		},
		get colorTheme(): "light" | "dark" {
			const settings = configurationManager.getSettings();
			if (settings) {
				return settings?.workbench.colorTheme.includes("Light") ? "light" : "dark";
			} else {
				return config.colorTheme;
			}
		},
		get mathjaxScale(): number {
			return configurationManager.getSettings()?.quarto.mathjax.scale || config.mathjaxScale;
		},
		get mathjaxExtensions(): readonly MathjaxSupportedExtension[] {
			return configurationManager.getSettings()?.quarto.mathjax.extensions || [];
		}
	}
}



export function getDiagnosticsOptions(config: ConfigurationManager): DiagnosticOptions {
	const settings = config.getSettings();
	if (!settings) {
		return defaultDiagnosticOptions;
	}

	const validateFragmentLinks = convertDiagnosticLevel(settings.markdown.validate.fragmentLinks.enabled);
	return {
		validateFileLinks: convertDiagnosticLevel(settings.markdown.validate.fileLinks.enabled),
		validateReferences: convertDiagnosticLevel(settings.markdown.validate.referenceLinks.enabled),
		validateFragmentLinks: convertDiagnosticLevel(settings.markdown.validate.fragmentLinks.enabled),
		validateMarkdownFileLinkFragments: settings.markdown.validate.fileLinks.markdownFragmentLinks === 'inherit' ? validateFragmentLinks : convertDiagnosticLevel(settings.markdown.validate.fileLinks.markdownFragmentLinks),
		validateUnusedLinkDefinitions: convertDiagnosticLevel(settings.markdown.validate.unusedLinkDefinitions.enabled),
		validateDuplicateLinkDefinitions: convertDiagnosticLevel(settings.markdown.validate.duplicateLinkDefinitions.enabled),
		ignoreLinks: settings.markdown.validate.ignoredLinks,
	};
}

const defaultDiagnosticOptions: DiagnosticOptions = {
	validateFileLinks: DiagnosticLevel.ignore,
	validateReferences: DiagnosticLevel.ignore,
	validateFragmentLinks: DiagnosticLevel.ignore,
	validateMarkdownFileLinkFragments: DiagnosticLevel.ignore,
	validateUnusedLinkDefinitions: DiagnosticLevel.ignore,
	validateDuplicateLinkDefinitions: DiagnosticLevel.ignore,
	ignoreLinks: [],
};

function convertDiagnosticLevel(enabled: ValidateEnabled): DiagnosticLevel | undefined {
	switch (enabled) {
		case 'error': return DiagnosticLevel.error;
		case 'warning': return DiagnosticLevel.warning;
		case 'ignore': return DiagnosticLevel.ignore;
		case 'hint': return DiagnosticLevel.hint;
		default: return DiagnosticLevel.ignore;
	}
}

