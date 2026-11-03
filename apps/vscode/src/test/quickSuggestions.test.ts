/*
 * quickSuggestions.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";

import { isQuickSuggestionsSettingEnabled } from "../providers/editor/prefs";

// The visual editor only shows completions (including snippets) automatically
// while typing in a code cell when VS Code's `editor.quickSuggestions` setting
// enables them for ordinary text. The setting accepts booleans, a single
// string, or a per-category object, and VS Code 1.121 changed its default from
// "on" to "offWhenInlineCompletions".
suite("quickSuggestionsEnabled", () => {
  test("treats the VS Code 1.121 default as enabled", () => {
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ other: "offWhenInlineCompletions", comments: "off", strings: "off" }), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled("offWhenInlineCompletions"), true);
  });

  test("treats the pre-1.121 default and explicit on as enabled", () => {
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ other: "on", comments: "off", strings: "off" }), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled("on"), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled(true), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ other: true }), true);
  });

  test("treats off and inline as disabled", () => {
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ other: "off" }), false);
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ other: "inline" }), false);
    assert.strictEqual(isQuickSuggestionsSettingEnabled("off"), false);
    assert.strictEqual(isQuickSuggestionsSettingEnabled("inline"), false);
    assert.strictEqual(isQuickSuggestionsSettingEnabled(false), false);
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ other: false }), false);
  });

  test("falls back to enabled when the setting is missing or malformed", () => {
    assert.strictEqual(isQuickSuggestionsSettingEnabled(undefined), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled(null), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled({}), true);
    assert.strictEqual(isQuickSuggestionsSettingEnabled({ comments: "off" }), true);
  });
});
