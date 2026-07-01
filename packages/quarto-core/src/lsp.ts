/*
 * lsp.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export interface LspInitializationOptions {
  quartoBinPath?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}
