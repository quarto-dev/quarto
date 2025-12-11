import * as vscode from "vscode";
import * as assert from "assert";
import { decodeSemanticTokens, encodeSemanticTokens, remapTokenIndices } from "../providers/semantic-tokens";

suite("Semantic Tokens", function () {

  test("Encode and decode semantic tokens roundtrip", function () {
    // Create a set of semantic tokens in absolute format
    const tokens = [
      { line: 0, startChar: 0, length: 3, tokenType: 1, tokenModifiers: 0 },
      { line: 0, startChar: 4, length: 4, tokenType: 2, tokenModifiers: 1 },
      { line: 2, startChar: 2, length: 5, tokenType: 3, tokenModifiers: 2 },
    ];

    // Encode to delta format
    const encoded = encodeSemanticTokens(tokens);

    // Verify the encoded data has the expected structure
    assert.ok(encoded.data, "Encoded tokens should have data property");
    assert.strictEqual(encoded.data.length, 15, "Encoded data should have 15 elements (3 tokens x 5 fields)");

    // Decode back to absolute format
    const decoded = decodeSemanticTokens(encoded);

    // Verify roundtrip produces original tokens
    assert.deepStrictEqual(decoded, tokens, "Decoded tokens should match original tokens");
  });

  test("Decode semantic tokens with delta encoding", function () {
    // Create semantic tokens in delta-encoded format
    // Format: [deltaLine, deltaStartChar, length, tokenType, tokenModifiers, ...]
    const deltaEncoded: vscode.SemanticTokens = {
      data: new Uint32Array([
        0, 5, 3, 1, 0,    // line 0, char 5, length 3
        0, 4, 4, 2, 1,    // line 0 (0+0), char 9 (5+4), length 4
        2, 0, 5, 3, 2,    // line 2 (0+2), char 0 (reset), length 5
      ]),
      resultId: undefined
    };

    const decoded = decodeSemanticTokens(deltaEncoded);

    // Verify the decoded tokens have correct absolute positions
    assert.strictEqual(decoded.length, 3, "Should decode 3 tokens");
    assert.deepStrictEqual(decoded[0], { line: 0, startChar: 5, length: 3, tokenType: 1, tokenModifiers: 0 });
    assert.deepStrictEqual(decoded[1], { line: 0, startChar: 9, length: 4, tokenType: 2, tokenModifiers: 1 });
    assert.deepStrictEqual(decoded[2], { line: 2, startChar: 0, length: 5, tokenType: 3, tokenModifiers: 2 });
  });

  test("Legend mapping remaps matching token types", function () {
    // Source legend has types at different indices than target
    const sourceLegend = {
      tokenTypes: ["class", "function", "variable"],
      tokenModifiers: ["readonly", "static"]
    };

    const targetLegend = {
      tokenTypes: ["variable", "function", "class"], // Different order
      tokenModifiers: ["static", "readonly"] // Different order
    };

    // Create tokens using source indices
    const sourceTokens = encodeSemanticTokens([
      { line: 0, startChar: 0, length: 3, tokenType: 0, tokenModifiers: 0 }, // "class" in source
      { line: 1, startChar: 0, length: 4, tokenType: 1, tokenModifiers: 0 }, // "function" in source
      { line: 2, startChar: 0, length: 5, tokenType: 2, tokenModifiers: 0 }, // "variable" in source
    ]);

    // Remap to target legend
    const remapped = remapTokenIndices(sourceTokens, sourceLegend, targetLegend);
    const decoded = decodeSemanticTokens(remapped);

    // Verify types were remapped to target indices
    assert.strictEqual(decoded.length, 3, "Should have 3 tokens");
    assert.strictEqual(decoded[0].tokenType, 2, "class should map to index 2 in target");
    assert.strictEqual(decoded[1].tokenType, 1, "function should map to index 1 in target");
    assert.strictEqual(decoded[2].tokenType, 0, "variable should map to index 0 in target");
  });

  test("Legend mapping filters out unmapped token types", function () {
    // Source legend has types that don't exist in target
    const sourceLegend = {
      tokenTypes: ["class", "customType", "function", "anotherCustomType"],
      tokenModifiers: []
    };

    const targetLegend = {
      tokenTypes: ["class", "function"], // Only has class and function
      tokenModifiers: []
    };

    // Create tokens including unmapped types
    const sourceTokens = encodeSemanticTokens([
      { line: 0, startChar: 0, length: 3, tokenType: 0, tokenModifiers: 0 }, // "class" - should be kept
      { line: 1, startChar: 0, length: 4, tokenType: 1, tokenModifiers: 0 }, // "customType" - should be filtered
      { line: 2, startChar: 0, length: 5, tokenType: 2, tokenModifiers: 0 }, // "function" - should be kept
      { line: 3, startChar: 0, length: 6, tokenType: 3, tokenModifiers: 0 }, // "anotherCustomType" - should be filtered
    ]);

    // Remap to target legend
    const remapped = remapTokenIndices(sourceTokens, sourceLegend, targetLegend);
    const decoded = decodeSemanticTokens(remapped);

    // Verify unmapped types were filtered out
    assert.strictEqual(decoded.length, 2, "Should have 2 tokens after filtering");
    assert.strictEqual(decoded[0].tokenType, 0, "class should map to index 0");
    assert.strictEqual(decoded[0].line, 0, "First token should be from line 0");
    assert.strictEqual(decoded[1].tokenType, 1, "function should map to index 1");
    assert.strictEqual(decoded[1].line, 2, "Second token should be from line 2");
  });

  test("Legend mapping remaps modifier bitfields correctly", function () {
    // Source and target have modifiers in different positions
    const sourceLegend = {
      tokenTypes: ["function"],
      tokenModifiers: ["readonly", "static", "async"] // indices 0, 1, 2
    };

    const targetLegend = {
      tokenTypes: ["function"],
      tokenModifiers: ["async", "readonly", "static"] // indices 0, 1, 2 (reordered)
    };

    // Create token with multiple modifiers set
    // In source: readonly=bit 0, static=bit 1, async=bit 2
    const modifierBits = (1 << 0) | (1 << 1); // readonly + static in source
    const sourceTokens = encodeSemanticTokens([
      { line: 0, startChar: 0, length: 3, tokenType: 0, tokenModifiers: modifierBits }
    ]);

    // Remap to target legend
    const remapped = remapTokenIndices(sourceTokens, sourceLegend, targetLegend);
    const decoded = decodeSemanticTokens(remapped);

    // In target: async=bit 0, readonly=bit 1, static=bit 2
    const expectedModifiers = (1 << 1) | (1 << 2); // readonly + static in target
    assert.strictEqual(decoded[0].tokenModifiers, expectedModifiers, "Modifiers should be remapped to target positions");
  });

  test("Legend mapping handles modifiers not in target legend", function () {
    // Source has modifiers that don't exist in target
    const sourceLegend = {
      tokenTypes: ["function"],
      tokenModifiers: ["readonly", "customModifier", "static"]
    };

    const targetLegend = {
      tokenTypes: ["function"],
      tokenModifiers: ["readonly", "static"] // Missing "customModifier"
    };

    // Set all three modifiers in source
    const modifierBits = (1 << 0) | (1 << 1) | (1 << 2); // all three modifiers
    const sourceTokens = encodeSemanticTokens([
      { line: 0, startChar: 0, length: 3, tokenType: 0, tokenModifiers: modifierBits }
    ]);

    // Remap to target legend
    const remapped = remapTokenIndices(sourceTokens, sourceLegend, targetLegend);
    const decoded = decodeSemanticTokens(remapped);

    // Only readonly and static should be mapped; customModifier should be dropped
    const expectedModifiers = (1 << 0) | (1 << 1); // readonly + static in target
    assert.strictEqual(decoded[0].tokenModifiers, expectedModifiers, "Unmapped modifiers should be filtered out");
  });

});
