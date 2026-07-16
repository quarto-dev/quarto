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

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@posit-dev/positron-test-electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a throwaway user-data-dir seeded with settings that turn off extension
 * auto-update, and return `--user-data-dir <dir>` launch args pointing at it.
 *
 * We run with extensions enabled (see `disableExtensions: false` below) so
 * Positron's bundled extensions stay available, but that also leaves the
 * extension gallery active. On startup Positron then auto-updates "outdated"
 * extensions, and it treats the Quarto extension we load from
 * `extensionDevelopmentPath` as one of them: it disables/removes it mid-run, so
 * `vscode.extensions.getExtension("quarto.quarto")` is gone by the time the
 * tests query it ("Extension quarto.quarto not found"). Disabling auto-update
 * keeps our development extension in place.
 *
 * `@posit-dev/positron-test-electron` always passes its own `--user-data-dir`
 * first and appends ours last; Positron uses the last occurrence, so ours wins.
 * A short `os.tmpdir()` prefix keeps the derived IPC socket path under macOS's
 * 103-char Unix-socket limit.
 */
function seededUserDataDirArgs() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qpt-"));
  fs.mkdirSync(path.join(userDataDir, "User"), { recursive: true });
  fs.writeFileSync(
    path.join(userDataDir, "User", "settings.json"),
    JSON.stringify({
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false,
    })
  );
  return ["--user-data-dir", userDataDir];
}

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
    disableExtensions: false,
    launchArgs: seededUserDataDirArgs(),
  });

  process.exit(code);
}

main().catch((err) => {
  console.error("Failed to run Positron integration tests:");
  console.error(err);
  process.exit(1);
});
