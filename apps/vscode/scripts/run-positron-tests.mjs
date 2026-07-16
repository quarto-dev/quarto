/*
 * run-positron-tests.mjs
 *
 * Launcher for the Positron-only integration tests. Downloads (or reuses a
 * cached) Positron build and runs the compiled Mocha entry point
 * (`test-out/positron/index.js`) inside it, via `@posit-dev/positron-test-electron`.
 *
 * Run with: `yarn test-positron` (which builds the tests first).
 *
 * Following the VS Code extension testing pattern, the tests run with
 * `--disable-extensions` (applied by the harness) so the Quarto extension is
 * exercised in isolation. Positron's own API global and bundled extensions
 * (language runtimes, notebook export) remain available.
 *
 * Set POSITRON_CHANNEL=daily to test against a daily build (default: stable).
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@posit-dev/positron-test-electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Extension root (contains package.json); `scripts/` lives one level below it.
  const extensionDevelopmentPath = path.resolve(__dirname, "..");

  // Compiled Mocha entry point that discovers and runs the Positron tests.
  const extensionTestsPath = path.resolve(
    extensionDevelopmentPath,
    "test-out",
    "positron",
    "index.js"
  );

  const code = await runTests({
    channel: process.env.POSITRON_CHANNEL === "daily" ? "daily" : "stable",
    extensionDevelopmentPath,
    extensionTestsPath,
    // Our tests exercise Positron's bundled extensions (notebook export and the
    // R/Python runtimes), so opt out of the default `--disable-extensions`.
    // Extension auto-update (which would otherwise evict the extension loaded
    // from extensionDevelopmentPath) is disabled by @posit-dev/positron-test-
    // electron itself, so no extra launch args are needed here.
    disableExtensions: false,
  });

  process.exit(code);
}

main().catch((err) => {
  console.error("Failed to run Positron integration tests:");
  console.error(err);
  process.exit(1);
});
