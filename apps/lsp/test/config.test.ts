/*
 * config.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Tests for converting the client's configuration into the language
 * server's settings and diagnostic options, and that link diagnostics are
 * produced once they are enabled.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CancellationToken, Connection, Emitter, TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI, Utils } from "vscode-uri";

import { Document, markdownitParser } from "quarto-core";

import { ConfigurationManager, getDiagnosticsOptions } from "../src/config";
import { Logger } from "../src/logging";
import { createLanguageService, DiagnosticLevel, IWorkspace } from "../src/service";
import { Quarto } from "../src/quarto";
import { defaultLsConfiguration } from "../src/service/config";

const logger = new Logger(() => { /* quiet */ });

// Configuration manager whose client answers `workspace/configuration`
// requests from a map of section name to value.
async function configFrom(sections: Record<string, unknown>) {
  const connection = {
    workspace: {
      getConfiguration: async (items: { section: string }[]) =>
        items.map(item => sections[item.section] ?? null),
    },
  } as unknown as Connection;
  const manager = new ConfigurationManager(connection, logger);
  await manager.update();
  return manager;
}

// The `markdown.validate` values VS Code sends when its built-in Markdown
// extension is present and the user hasn't changed anything.
const vscodeValidateDefaults = {
  enabled: false,
  referenceLinks: { enabled: "warning" },
  fragmentLinks: { enabled: "warning" },
  fileLinks: { enabled: "warning", markdownFragmentLinks: "inherit" },
  ignoredLinks: [],
  unusedLinkDefinitions: { enabled: "hint" },
  duplicateLinkDefinitions: { enabled: "warning" },
};

test("markdown validation is off by default", async () => {
  for (const validate of [undefined, vscodeValidateDefaults]) {
    const manager = await configFrom({ "markdown.validate": validate });
    assert.equal(getDiagnosticsOptions(manager).enabled, false);
  }
});

test("markdown validation follows the client's markdown.validate settings", async () => {
  const manager = await configFrom({
    "markdown.validate": {
      ...vscodeValidateDefaults,
      enabled: true,
      fileLinks: { enabled: "error", markdownFragmentLinks: "inherit" },
      ignoredLinks: ["/assets/**"],
    },
  });
  assert.deepEqual(getDiagnosticsOptions(manager), {
    enabled: true,
    validateFileLinks: DiagnosticLevel.error,
    validateReferences: DiagnosticLevel.warning,
    validateFragmentLinks: DiagnosticLevel.warning,
    validateMarkdownFileLinkFragments: DiagnosticLevel.warning,
    validateUnusedLinkDefinitions: DiagnosticLevel.hint,
    validateDuplicateLinkDefinitions: DiagnosticLevel.warning,
    ignoreLinks: ["/assets/**"],
  });
});

test("missing or invalid markdown.validate values fall back to the defaults", async () => {
  const manager = await configFrom({
    "markdown.validate": {
      enabled: true,
      referenceLinks: { enabled: "loud" },
      ignoredLinks: "not-an-array",
    },
  });
  assert.deepEqual(getDiagnosticsOptions(manager), {
    enabled: true,
    validateFileLinks: DiagnosticLevel.ignore,
    validateReferences: DiagnosticLevel.ignore,
    validateFragmentLinks: DiagnosticLevel.ignore,
    validateMarkdownFileLinkFragments: DiagnosticLevel.ignore,
    validateUnusedLinkDefinitions: DiagnosticLevel.ignore,
    validateDuplicateLinkDefinitions: DiagnosticLevel.ignore,
    ignoreLinks: [],
  });
});

test("the quarto settings are still read alongside markdown.validate", async () => {
  const manager = await configFrom({
    workbench: { colorTheme: "Light+" },
    quarto: { mathjax: { scale: 2 } },
    "markdown.validate": { ...vscodeValidateDefaults, enabled: true },
  });
  const settings = manager.getSettings();
  assert.equal(settings.workbench.colorTheme, "Light+");
  assert.equal(settings.quarto.mathjax.scale, 2);
  assert.equal(settings.markdown.validate.enabled, true);
});

// Minimal in-memory workspace holding the given documents.
function memoryWorkspace(root: URI, docs: Document[]): IWorkspace {
  const byUri = new Map(docs.map(doc => [doc.uri, doc]));
  return {
    workspaceFolders: [root],
    onDidChangeMarkdownDocument: new Emitter<Document>().event,
    onDidCreateMarkdownDocument: new Emitter<Document>().event,
    onDidDeleteMarkdownDocument: new Emitter<URI>().event,
    getAllMarkdownDocuments: async () => docs,
    hasMarkdownDocument: (resource: URI) => byUri.has(resource.toString()),
    openMarkdownDocument: async (resource: URI) => byUri.get(resource.toString()),
    stat: async (resource: URI) => byUri.has(resource.toString()) ? { isDirectory: false } : undefined,
    readDirectory: async () => [],
  };
}

test("link diagnostics are reported for a Quarto document once enabled", async () => {
  const root = URI.file("/project");
  const doc = TextDocument.create(Utils.joinPath(root, "doc.qmd").toString(), "quarto", 1, [
    "## Introduction",
    "",
    "See [intro](#introduction), [nowhere](#no-such-header),",
    "[missing](missing.qmd), and [undefined][no-such-ref].",
    "",
    "[unused]: https://example.com",
    "",
  ].join("\n"));
  const mdLs = createLanguageService({
    config: defaultLsConfiguration(),
    quarto: {} as Quarto,
    workspace: memoryWorkspace(root, [doc]),
    documents: new TextDocuments(TextDocument),
    parser: markdownitParser(),
    logger,
  });

  const disabled = await configFrom({ "markdown.validate": vscodeValidateDefaults });
  assert.deepEqual(
    await mdLs.computeDiagnostics(doc, getDiagnosticsOptions(disabled), CancellationToken.None),
    []
  );

  const enabled = await configFrom({ "markdown.validate": { ...vscodeValidateDefaults, enabled: true } });
  const diagnostics = await mdLs.computeDiagnostics(doc, getDiagnosticsOptions(enabled), CancellationToken.None);
  const codes = diagnostics.map(d => d.code).sort();
  assert.deepEqual(codes, ["link.no-such-file", "link.no-such-header-in-own-file", "link.no-such-reference", "link.unused-definition"]);
});
