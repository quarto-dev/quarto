import * as assert from "assert";
import { extension } from "./extension";
import { QuartoExtensionApi } from "../api";

suite("Quarto Extension API", function () {
  test("Extension exports the API", async function () {
    const ext = extension();

    if (!ext.isActive) {
      await ext.activate();
    }

    const api = ext.exports as QuartoExtensionApi;

    assert.ok(api, "Extension should export an API");
    assert.strictEqual(typeof api.getQuartoPath, "function", "API should have getQuartoPath method");
    assert.strictEqual(typeof api.getQuartoVersion, "function", "API should have getQuartoVersion method");
    assert.strictEqual(typeof api.isQuartoAvailable, "function", "API should have isQuartoAvailable method");
  });

  test("API methods return expected types", async function () {
    const ext = extension();

    if (!ext.isActive) {
      await ext.activate();
    }

    const api = ext.exports as QuartoExtensionApi;

    const isAvailable = api.isQuartoAvailable();
    assert.strictEqual(typeof isAvailable, "boolean", "isQuartoAvailable should return a boolean");

    const path = api.getQuartoPath();
    if (isAvailable) {
      assert.strictEqual(typeof path, "string", "getQuartoPath should return a string when Quarto is available");
      assert.ok(path!.length > 0, "getQuartoPath should return a non-empty string");
    } else {
      assert.strictEqual(path, undefined, "getQuartoPath should return undefined when Quarto is not available");
    }

    const version = api.getQuartoVersion();
    if (isAvailable) {
      assert.strictEqual(typeof version, "string", "getQuartoVersion should return a string when Quarto is available");
      assert.ok(version!.length > 0, "getQuartoVersion should return a non-empty string");
    } else {
      assert.strictEqual(version, undefined, "getQuartoVersion should return undefined when Quarto is not available");
    }
  });
});
