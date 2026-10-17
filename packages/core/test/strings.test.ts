import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";

import { shQuote, shQuoteUnknownShell } from "../src/strings";

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
  // Double quotes group words, but cmd.exe still expands %NAME% inside them
  // (and !NAME! with delayed expansion). cmd expands %NAME% before it
  // processes carets, so the output is safe because the " and ^ break the
  // variable name — cmd sees %"PATH"^%, no such variable is defined, and
  // cmd keeps the text. A literal " is "" per CommandLineToArgvW, and
  // trailing backslashes of each part are doubled so \" is not read as a
  // literal quote.
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
    // A trailing backslash must be doubled before the closing quote, or
    // CommandLineToArgvW reads \" as a literal quote (quarto-dev/quarto#1197).
    ["C:\\", '"C:\\\\"'],
  ];
  for (const [value, expected] of cases) {
    assert.equal(shQuote(value, "cmd"), expected, JSON.stringify(value));
  }
});

test("shQuoteUnknownShell keeps the pre-shell-aware behavior", () => {
  // Fallback for an unrecognized terminal shell: quote only on whitespace.
  const cases: Array<[string, string]> = [
    ["quarto", "quarto"],
    ["C:/Users/me/Article(md)/01_introduction.md", "C:/Users/me/Article(md)/01_introduction.md"],
    ["a b", '"a b"'],
  ];
  for (const [value, expected] of cases) {
    assert.equal(shQuoteUnknownShell(value), expected, JSON.stringify(value));
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

test(
  "shQuote powershell output round-trips through pwsh to a native command",
  { skip: !hasPwsh() && "pwsh is not installed" },
  () => {
    // Behavior-based check: pass each serialized value from pwsh to a native
    // executable (node), the same way the generated terminal command passes
    // the target path to quarto. The $(...) case is a canary: if the value
    // were not literal, pwsh would run it and print "PWNED".
    const node = shQuote(process.execPath, "powershell");
    const script = shQuote(
      "process.stdout.write(process.argv[1])",
      "powershell"
    );
    const values = [
      "C:/Users/me/Article(md)/01_introduction.md",
      "a b",
      "a$b",
      "$HOME",
      "$(echo PWNED)",
      "a`b",
      "a'b",
      'a"b',
      "a\\b",
      "a\nb",
      "a;b",
      "a@b",
      "a&b",
      "a|b",
      "a#b",
      "%PATH%",
      "",
    ];
    for (const value of values) {
      const quoted = shQuote(value, "powershell");
      const roundTripped = execFileSync(
        "pwsh",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `& ${node} -e ${script} ${quoted}`,
        ],
        { encoding: "utf-8" }
      );
      assert.equal(roundTripped, value, JSON.stringify(value));
    }
  }
);

function hasPwsh(): boolean {
  try {
    execFileSync("pwsh", ["-NoProfile", "-Command", "exit 0"]);
    return true;
  } catch {
    return false;
  }
}
