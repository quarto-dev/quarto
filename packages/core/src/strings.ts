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
      // Double quotes group words for CommandLineToArgvW, but cmd.exe still
      // expands %NAME% inside them (and !NAME! with delayed expansion).
      // Note that cmd expands %NAME% before it processes carets, so ^%
      // does not itself stop the expansion: the output is safe because the
      // " and ^ characters break the variable name — cmd sees %"PATH"^%,
      // no such variable is defined, and cmd keeps the text. Emit each %
      // and ! outside the quotes, caret-escaped; a literal " is ""
      // per CommandLineToArgvW. A part ending in a backslash needs its
      // trailing backslashes doubled, otherwise CommandLineToArgvW reads
      // \" as a literal quote instead of the closing quote.
      return value
        .split(/([%!])/)
        .map((part) =>
          part === "%" || part === "!"
            ? `^${part}`
            : `"${part.replace(/"/g, `""`).replace(/(\\+)$/, "$1$1")}"`
        )
        .join("");
    }
  }
}

// Quoting for when the terminal's shell is not recognized. Without the
// shell's literal-quoting rules, quote only on whitespace, using double
// quotes, which most shells accept for grouping words.
export function shQuoteUnknownShell(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}
