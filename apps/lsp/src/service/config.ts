/*
 * config.ts
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

import * as picomatch from 'picomatch';
import { URI } from 'vscode-uri';

/**
 * Preferred style for file paths to {@link markdownFileExtensions markdown files}.
 */
export enum PreferredMdPathExtensionStyle {
	/**
	 * Try to maintain the existing of the path.
	 */
	auto = 'auto',

	/**
	 * Include the file extension when possible.
	 */
	includeExtension = 'includeExtension',

	/**
	 * Drop the file extension when possible.
	 */
	removeExtension = 'removeExtension',
}

export interface LsConfiguration {
	/**
	 * List of file extensions should be considered markdown.
	 *
	 * These should not include the leading `.`.
	 *
	 * The first entry is treated as the default file extension.
	 */
	readonly markdownFileExtensions: readonly string[];

	/**
	 * List of file extension for files that are linked to from markdown .
	 *
	 * These should not include the leading `.`.
	 *
	 * These are used to avoid duplicate checks when resolving links without
	 * a file extension.
	 */
	readonly knownLinkedToFileExtensions: readonly string[];

	/**
	 * List of path globs that should be excluded from cross-file operations.
	 */
	readonly excludePaths: readonly string[];

	/**
	 * Preferred style for file paths to {@link markdownFileExtensions markdown files}.
	 * 
	 * This is used for paths added by the language service, such as for path completions and on file renames.
	 */
	readonly preferredMdPathExtensionStyle?: PreferredMdPathExtensionStyle;
}

export const defaultMarkdownFileExtension = 'qmd';

const defaultConfig: LsConfiguration = {
	markdownFileExtensions: [defaultMarkdownFileExtension, 'md'],
	knownLinkedToFileExtensions: [
		'jpg',
		'jpeg',
		'png',
		'gif',
		'webp',
		'bmp',
		'tiff',
		'svg',
		'pdf'
	],
	excludePaths: [
		'**/.*',
		'**/node_modules/**',
		"**/renv/**", 
		"**/packrat/**", 
		"**/rsconnect/**",
		"**/venv/**",
		"**/env/**",
		"**/_extensions/**"
	]
};

export function getLsConfiguration(overrides: Partial<LsConfiguration>): LsConfiguration {
	return new Proxy<LsConfiguration>(Object.create(null), {
		get(_target, p: keyof LsConfiguration) {
			return p in overrides ? overrides[p] : defaultConfig[p];
		},
	});
}

export function isExcludedPath(configuration: LsConfiguration, uri: URI): boolean {
	return configuration.excludePaths.some(excludePath => picomatch.isMatch(uri.path, excludePath));
}
