import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";

import { shQuote } from "../src/strings";

test("shQuote serializes one literal argument for POSIX sh", () => {
  // Single quotes are fully literal in POSIX shells.
  const cases: Array<[string, string]> = [
    ["quarto", "'quarto'"],
    // Parentheses without whitespace (quarto-dev/quarto#1194): the original
    // report, where PowerShell parsed `(md)` as a subexpression.
    ["c:/Users/me/Article(md)/01_introduction.md", "'c:/Users/me/Article(md)/01_introduction.md'"],
    ["a b", "'a b'"],
    ["a$b", "'a$b'"],
    ["$HOME", "'$HOME'"],
    ["$(echo PWNED)", "'$(echo PWNED)'"],
    ["a`b", "'a`b'"],
    ['a"b', `'a"b'`],
    ["a\\b", "'a\\b'"],
    ["a\nb", "'a\nb'"],
    ["a;b", "'a;b'"],
    ["a@b", "'a@b'"],
    ["a&b", "'a&b'"],
    ["a|b", "'a|b'"],
    ["a*b", "'a*b'"],
    ["a?b", "'a?b'"],
    ["a~b", "'a~b'"],
    ["", "''"],
    // An embedded single quote closes, escapes, and reopens the quoting.
    ["a'b", "'a'\\''b'"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(shQuote(value, "posix"), expected, JSON.stringify(value));
  }
});

test("shQuote serializes one literal argument for PowerShell", () => {
  // Single-quoted strings are fully literal in PowerShell ($, backtick, and
  // double quotes included); an embedded single quote is doubled.
  const cases: Array<[string, string]> = [
    ["quarto", "'quarto'"],
    [
      "C:/Users/me/Article(md)/01_introduction.md",
      "'C:/Users/me/Article(md)/01_introduction.md'",
    ],
    ["a b", "'a b'"],
    ["a$b", "'a$b'"],
    ["$HOME", "'$HOME'"],
    ["a@b", "'a@b'"],
    ["a`b", "'a`b'"],
    ['a"b', `'a"b'`],
    ["a\nb", "'a\nb'"],
    ["a'b", "'a''b'"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(shQuote(value, "powershell"), expected, JSON.stringify(value));
  }
});

test("shQuote serializes one literal argument for cmd.exe", () => {
  // Double quotes group words, but %NAME% still expands inside them (and
  // !NAME! with delayed expansion), so % and ! are emitted outside the
  // quotes caret-escaped; a literal " is "" per CommandLineToArgvW.
  const cases: Array<[string, string]> = [
    ["quarto", '"quarto"'],
    ["C:\\dir(name)\\file.qmd", '"C:\\dir(name)\\file.qmd"'],
    ["a b", '"a b"'],
    ["a&b", '"a&b"'],
    ["a%b", '"a"^%"b"'],
    ["100%", '"100"^%""'],
    ["%PATH%", '""^%"PATH"^%""'],
    ["a!b", '"a"^!"b"'],
    ['a"b', '"a""b"'],
  ];
  for (const [value, expected] of cases) {
    assert.equal(shQuote(value, "cmd"), expected, JSON.stringify(value));
  }
});

test(
  "shQuote posix output round-trips through a real shell",
  { skip: process.platform === "win32" },
  () => {
    // Behavior-based check: the serialized argument must survive a real
    // POSIX shell as one literal argument. The $(...)/backtick cases double
    // as canaries: if the serializer ever emitted them unquoted or merely
    // double-quoted, the shell would execute them and the output would be
    // "PWNED" instead of the literal text.
    const values = [
      "quarto",
      "c:/Users/me/Article(md)/01_introduction.md",
      "a b",
      "a$b",
      "$HOME",
      "$(echo PWNED)",
      "a`b",
      "`echo PWNED`",
      "a'b",
      'a"b',
      "a\\b",
      "a\nb",
      "a;b",
      "a@b",
      "a&b",
      "a|b",
      "a*b",
      "a?b",
      "a~b",
      "a#b",
      "",
    ];
    for (const value of values) {
      const quoted = shQuote(value, "posix");
      const roundTripped = execFileSync("bash", ["-c", `printf %s ${quoted}`], {
        encoding: "utf-8",
      });
      assert.equal(roundTripped, value, JSON.stringify(value));
    }
  }
);
