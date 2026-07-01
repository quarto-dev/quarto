/*
 * pandoc_capabilities.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { PandocServer, parsePandocListOutput, PandocApiVersion } from './pandoc';

export interface PandocCapabilities {
  version: string;
  api_version: PandocApiVersion;
  output_formats: string[];
  highlight_languages: string[];
}

export async function getPandocCapabilities(server: PandocServer) {
  const result = await server.getCapabilities();
  return {
    version: result.version,
    api_version: result.api_version,
    output_formats: parsePandocListOutput(result.output_formats),
    highlight_languages: parsePandocListOutput(result.highlight_languages),
  };
}
