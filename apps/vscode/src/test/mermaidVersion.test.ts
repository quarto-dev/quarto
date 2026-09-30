/*
 * mermaidVersion.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import semver from "semver";

import { initQuartoContext } from "quarto-core";

import { EXTENSION_ROOT_DIR, emitActionsWarning } from "./test-utils";

// The Mermaid build the Diagram preview webview loads: a copy of the `mermaid`
// npm package's dist/mermaid.min.js (the same file Quarto CLI vendors).
const bundledMermaidPath = path.join(
  EXTENSION_ROOT_DIR,
  "assets",
  "www",
  "diagram",
  "mermaid.min.js"
);

// The notebook Markdown renderer's build (apps/vscode-markdownit), which bundles
// the `mermaid` npm package into hashed chunks.
const notebookRendererDir = path.join(EXTENSION_ROOT_DIR, "out", "markdownit");

// Mermaid 11.3.0 introduced the `A@{ shape: ... }` node-shape syntax. Anything
// older renders those diagrams as "undefined" (see posit-dev/positron#13881).
const kMinShapeSyntaxVersion = "11.3.0";

// How a Mermaid build records its version, minified or not:
// - up to at least 11.12, it embeds Mermaid's package.json:
//   `name:"mermaid",version:"X.Y.Z"`
// - by 11.17 it no longer does, but render() passes the version to each
//   diagram's renderer: `renderer.draw(text, id, "X.Y.Z", diagram)`
const kVersionPatterns = [
  /name:\s*"mermaid",\s*version:\s*"([^"]+)"/,
  /renderer\.draw\(\w+,\s*\w+,\s*"(\d+\.\d+\.\d+[^"]*)"/,
];

/**
 * Extract the Mermaid version baked into a Mermaid bundle (the extension's
 * vendored build, the Quarto CLI's, or a chunk of the notebook renderer).
 */
function readMermaidVersion(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const contents = fs.readFileSync(filePath, "utf8");
  for (const pattern of kVersionPatterns) {
    const match = contents.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * The Mermaid versions bundled into the notebook renderer. The chunk that holds
 * the version has a hashed name, so look through all of them. Watch builds
 * don't clear the directory, so stale chunks can add more versions.
 */
function readNotebookRendererMermaidVersions(): string[] {
  if (!fs.existsSync(notebookRendererDir)) {
    return [];
  }
  const versions = new Set<string>();
  for (const file of fs.readdirSync(notebookRendererDir)) {
    if (file.endsWith(".js")) {
      const version = readMermaidVersion(path.join(notebookRendererDir, file));
      if (version) {
        versions.add(version);
      }
    }
  }
  return [...versions];
}

function readNotebookRendererMermaidVersion(): string {
  const versions = readNotebookRendererMermaidVersions();
  assert.ok(
    versions.length > 0,
    `Could not read a Mermaid version from ${notebookRendererDir}`
  );
  assert.strictEqual(
    versions.length,
    1,
    `Found several Mermaid versions (${versions.join(", ")}) in ${notebookRendererDir}; ` +
    `delete it and rebuild to clear out stale chunks.`
  );
  return versions[0];
}

function readBundledMermaidVersion(): string {
  const bundled = readMermaidVersion(bundledMermaidPath);
  assert.ok(bundled, `Could not read a Mermaid version from ${bundledMermaidPath}`);
  return bundled;
}

suite("Mermaid version", function () {
  test("bundled Mermaid supports the modern node-shape syntax", function () {
    const bundled = readBundledMermaidVersion();
    assert.ok(
      semver.gte(bundled, kMinShapeSyntaxVersion),
      `Bundled Mermaid is ${bundled}, which is older than ${kMinShapeSyntaxVersion}. ` +
      `Diagram preview will render newer node shapes (e.g. A@{ shape: text }) as "undefined".`
    );
  });

  // The notebook renderer's Mermaid comes from npm (apps/vscode-markdownit's
  // `mermaid` dependency) and the Diagram preview's is vendored. Both come from
  // the same npm release, so require the exact same version: a diagram then
  // renders the same in both, and re-vendoring is a file copy.
  test("notebook renderer Mermaid matches the Diagram preview's", function () {
    const bundled = readBundledMermaidVersion();
    const notebook = readNotebookRendererMermaidVersion();
    assert.strictEqual(
      notebook,
      bundled,
      `The notebook renderer's Mermaid (${notebook}) and the Diagram preview's (${bundled}) have drifted apart. ` +
      `Re-vendor the preview's by copying node_modules/mermaid/dist/mermaid.min.js to ${bundledMermaidPath}, ` +
      `or pin \`mermaid\` in apps/vscode-markdownit/package.json to ${bundled}.`
    );
  });

  // Drift detector: neither Mermaid should fall behind the Mermaid that the
  // resolved Quarto CLI ships, otherwise a diagram can render in `quarto
  // render` but break in the in-editor previews. Being ahead is fine. This
  // compares against whatever CLI is installed in the test environment, so it
  // skips when no CLI is available (e.g. CI without Quarto) and fires once the
  // CLI moves ahead.
  //
  // CI runs this against both the `release` and `pre-release` Quarto channels
  // (see .github/workflows/test.yaml). On `release` (and locally) drift is a
  // hard failure: we must keep up with the shipped CLI. On `pre-release` it's
  // only an early heads-up, since that Mermaid hasn't reached stable Quarto yet,
  // so we emit a warning annotation instead of failing. The channel is passed in
  // via the QUARTO_CHANNEL env var.
  test("Mermaid is not behind the installed Quarto CLI", function () {
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

    const behind: string[] = [];
    const bundled = readBundledMermaidVersion();
    if (semver.lt(bundled, cliVersion!)) {
      behind.push(`the Diagram preview's (${bundled}, ${bundledMermaidPath})`);
    }
    const notebook = readNotebookRendererMermaidVersion();
    if (semver.lt(notebook, cliVersion!)) {
      behind.push(`the notebook renderer's (${notebook}, apps/vscode-markdownit's \`mermaid\` dependency)`);
    }
    if (behind.length === 0) {
      return; // current with (or ahead of) the CLI
    }

    const advice =
      `The Quarto CLI ships Mermaid ${cliVersion}, which is ahead of ${behind.join(" and ")}. ` +
      `Upgrade \`mermaid\` in apps/vscode-markdownit/package.json, copy node_modules/mermaid/dist/mermaid.min.js ` +
      `to ${bundledMermaidPath}, and update assets/www/diagram/diagram.js if the Mermaid API changed.`;

    if (process.env.QUARTO_CHANNEL === "pre-release") {
      emitActionsWarning("Extension Mermaid is behind the Quarto pre-release CLI", advice);
      return;
    }

    assert.fail(advice);
  });
});
