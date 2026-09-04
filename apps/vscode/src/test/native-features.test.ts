import * as vscode from "vscode";
import * as assert from "assert";

import {
  detectNativeEmbeddedFeatures,
  isNativeEmbeddedLanguage,
  useNativeEmbeddedFeatures,
} from "../host/native-features";
import { embeddedLanguage } from "../vdoc/languages";

function language(name: string) {
  const found = embeddedLanguage(name);
  assert.ok(found, `Expected ${name} to be an embedded language`);
  return found;
}

suite("Native Embedded Features", function () {
  test("recognizes the languages Positron serves natively", function () {
    assert.strictEqual(isNativeEmbeddedLanguage(language("r")), true);
    assert.strictEqual(isNativeEmbeddedLanguage(language("python")), true);
  });

  test("does not recognize languages that keep their virtual document", function () {
    assert.strictEqual(isNativeEmbeddedLanguage(language("julia")), false);
    assert.strictEqual(isNativeEmbeddedLanguage(language("typescript")), false);
    assert.strictEqual(isNativeEmbeddedLanguage(language("sql")), false);
  });

  test("matches every alias of a native language", function () {
    // `embeddedLanguage` strips a leading engine prefix, so a `{r}` chunk and an
    // `{ojs-r}` one resolve to the same language object; the gate matches on the
    // language's own `ids` rather than on the chunk's text.
    assert.deepStrictEqual(language("r").ids, ["r"]);
    assert.deepStrictEqual(language("python").ids, ["python"]);
  });

  test("a probe can only see the internal command ids, not the public ones", async function () {
    const filtered = await vscode.commands.getCommands(true);
    const unfiltered = await vscode.commands.getCommands(false);

    assert.strictEqual(
      unfiltered.includes("vscode.executeDocumentSymbolProvider"),
      false,
      "API commands are not expected to be visible to getCommands"
    );
    assert.strictEqual(
      unfiltered.includes("_executeDocumentSymbolProvider"),
      true,
      "the internal command is expected to be visible when nothing is filtered"
    );
    assert.strictEqual(
      filtered.includes("_executeDocumentSymbolProvider"),
      false,
      "getCommands(true) is expected to filter underscore-prefixed ids"
    );
  });

  test("stays off when the host has no native cell commands", async function () {
    // Vanilla VS Code, which is what these tests run in: the Positron commands
    // are absent, so the gate is off no matter what the setting says.
    await detectNativeEmbeddedFeatures();

    assert.strictEqual(useNativeEmbeddedFeatures(), false);
    assert.strictEqual(useNativeEmbeddedFeatures(language("r")), false);
    assert.strictEqual(useNativeEmbeddedFeatures(language("python")), false);
  });
});
