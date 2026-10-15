/*
 * strings.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export function escapeRegExpCharacters(value: string): string {
  return value.replace(/[\\{}*+?|^$.[\]()]/g, "\\$&");
}

// The shell that will interpret a generated terminal command.
export type TerminalShell = "posix" | "powershell" | "cmd";

// Serialize one command-line argument so the target shell passes it to the
// child process as a single literal argument: no word splitting, globbing,
// or expansion. Always quotes, because each shell has its own literal-quoting
// rules and a generic double-quote wrapper is not enough (POSIX shells and
// PowerShell both still expand $HOME inside double quotes; cmd.exe still
// expands %NAME% inside them).
export function shQuote(value: string, shell: TerminalShell): string {
  switch (shell) {
    case "posix":
      // Single quotes are fully literal; an embedded single quote is
      // written as '\'' (close, escaped quote, reopen).
      return `'${value.replace(/'/g, `'\\''`)}'`;
    case "powershell":
      // Single-quoted strings are fully literal; an embedded single quote
      // is doubled.
      return `'${value.replace(/'/g, "''")}'`;
    case "cmd": {
      // Double quotes group words, but %NAME% still expands inside them
      // (and !NAME! when delayed expansion is on), where a caret escape
      // would itself be literal. Emit each % and ! outside the quotes
      // caret-escaped; a literal " is "" per CommandLineToArgvW.
      return value
        .split(/([%!])/)
        .map((part) =>
          part === "%" || part === "!"
            ? `^${part}`
            : `"${part.replace(/"/g, `""`)}"`
        )
        .join("");
    }
  }
}

export function winShEscape(value: string): string {
  return value.replace(" ", "^ ");
}
