/*
 * config.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as picomatch from 'picomatch';
import { URI } from 'vscode-uri';
import { MathjaxSupportedExtension } from 'editor-types';
import { LogLevel } from './logging';

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
  readonly logLevel: LogLevel;

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


  readonly includeWorkspaceHeaderCompletions: 'never' | 'onSingleOrDoubleHash' | 'onDoubleHash';

  readonly colorTheme: 'light' | 'dark';
  readonly mathjaxScale: number;
  readonly mathjaxExtensions: readonly MathjaxSupportedExtension[];
  readonly exportSymbolsToWorkspace: 'default' | 'all' | 'none';
  readonly showCodeCellsInOutline: boolean;
}

export const defaultMarkdownFileExtension = 'qmd';

const defaultConfig: LsConfiguration = {
  logLevel: LogLevel.Trace,
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
    "**/env/**"
  ],
  includeWorkspaceHeaderCompletions: 'never',
  colorTheme: 'light',
  mathjaxScale: 1,
  mathjaxExtensions: [],
  exportSymbolsToWorkspace: 'all',
  showCodeCellsInOutline: true
};

export function defaultLsConfiguration(): LsConfiguration {
  return defaultConfig;
}

export function isExcludedPath(configuration: LsConfiguration, uri: URI): boolean {
  return configuration.excludePaths.some(excludePath => picomatch.isMatch(uri.path, excludePath));
}
