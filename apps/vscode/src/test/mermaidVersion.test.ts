/*
 * mermaidVersion.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import semver from "semver";

import { initQuartoContext } from "quarto-core";

import { EXTENSION_ROOT_DIR } from "./test-utils";

// The Mermaid build the Diagram preview webview loads.
const bundledMermaidPath = path.join(
  EXTENSION_ROOT_DIR,
  "assets",
  "www",
  "diagram",
  "mermaid.min.js"
);

// Mermaid 11.3.0 introduced the `A@{ shape: ... }` node-shape syntax. Anything
// older renders those diagrams as "undefined" (see posit-dev/positron#13881).
const kMinShapeSyntaxVersion = "11.3.0";

/**
 * Extract the Mermaid version baked into a Mermaid bundle. Both the extension's
 * vendored build and the Quarto CLI's build embed Mermaid's own package.json,
 * so the version shows up as `name:"mermaid",version:"X.Y.Z"`.
 */
function readMermaidVersion(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const contents = fs.readFileSync(filePath, "utf8");
  const match = contents.match(/name:"mermaid",version:"([^"]+)"/);
  return match?.[1];
}

/**
 * Emit a GitHub Actions warning annotation (surfaced on the PR and in the run
 * summary). Outside Actions it just prints a line, which is harmless.
 * See https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions
 */
function emitActionsWarning(title: string, message: string): void {
  const data = message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  console.log(`::warning title=${title}::${data}`);
}

suite("Mermaid version", function () {
  test("bundled Mermaid supports the modern node-shape syntax", function () {
    const bundled = readMermaidVersion(bundledMermaidPath);
    assert.ok(
      bundled,
      `Could not read a Mermaid version from ${bundledMermaidPath}`
    );
    assert.ok(
      semver.gte(bundled, kMinShapeSyntaxVersion),
      `Bundled Mermaid is ${bundled}, which is older than ${kMinShapeSyntaxVersion}. ` +
      `Diagram preview will render newer node shapes (e.g. A@{ shape: text }) as "undefined".`
    );
  });

  // Drift detector: the Diagram preview should never fall behind the Mermaid
  // that the resolved Quarto CLI ships, otherwise a diagram can render in
  // `quarto render` but break in the in-editor preview. This compares against
  // whatever CLI is installed in the test environment, so it skips when no CLI
  // is available (e.g. CI without Quarto) and fires once the CLI moves ahead.
  //
  // CI runs this against both the `release` and `pre-release` Quarto channels
  // (see .github/workflows/test.yaml). On `release` (and locally) drift is a
  // hard failure: we must match the shipped CLI. On `pre-release` it's only an
  // early heads-up, since that Mermaid hasn't reached stable Quarto yet, so we
  // emit a warning annotation instead of failing. The channel is passed in via
  // the QUARTO_CHANNEL env var.
  test("bundled Mermaid is not behind the installed Quarto CLI", function () {
    const ctx = initQuartoContext();
    if (!ctx.available || !ctx.resourcePath) {
      this.skip();
    }

    const cliMermaidPath = path.join(
      ctx.resourcePath,
      "formats",
      "html",
      "mermaid",
      "mermaid.min.js"
    );
    const cliVersion = readMermaidVersion(cliMermaidPath);
    if (!cliVersion) {
      // CLI present but Mermaid build not found where we expect it; nothing to
      // compare against rather than a real drift, so don't fail the suite.
      this.skip();
    }

    const bundled = readMermaidVersion(bundledMermaidPath);
    assert.ok(
      bundled,
      `Could not read a Mermaid version from ${bundledMermaidPath}`
    );

    if (semver.gte(bundled, cliVersion!)) {
      return; // bundled build is current with (or ahead of) the CLI
    }

    // Drift detected: the bundled Mermaid is older than the installed CLI's.
    const advice =
      `Bundled Mermaid (${bundled}) is behind the Quarto CLI's Mermaid (${cliVersion}). ` +
      `Re-vendor it by copying ${cliMermaidPath} to ${bundledMermaidPath}, ` +
      `and update assets/www/diagram/diagram.js if the Mermaid API changed.`;

    if (process.env.QUARTO_CHANNEL === "pre-release") {
      emitActionsWarning("Diagram preview Mermaid is behind the Quarto pre-release CLI", advice);
      return;
    }

    assert.fail(advice);
  });
});
