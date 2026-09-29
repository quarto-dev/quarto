/*
 * mermaid-stub.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Mermaid renders through the DOM, which Node doesn't have. Import this module
 * before ../src/mermaid: it puts a stand-in for the `mermaid` package in the
 * module cache, and fakes the few DOM calls the plugin makes. The snapshots
 * then pin which fences become diagrams and the <img> the plugin emits, but
 * not Mermaid's own SVG.
 */

import { createRequire } from "node:module";

const require = createRequire(__filename);
const mermaidPath = require.resolve("mermaid");

const stub = {
  initialize: () => undefined,
  mermaidAPI: {
    render: (_id: string, text: string, cb: (svg: string) => void) => {
      cb(`<svg>${text.trim()}</svg>`);
    },
  },
};

require.cache[mermaidPath] = {
  id: mermaidPath,
  filename: mermaidPath,
  loaded: true,
  exports: stub,
} as unknown as (typeof require.cache)[string];

Object.assign(globalThis, {
  document: {
    body: { appendChild: () => undefined },
    createElement: () => ({ remove: () => undefined }),
    getElementById: () => ({ style: { maxWidth: "100px", maxHeight: "50px" } }),
  },
});
