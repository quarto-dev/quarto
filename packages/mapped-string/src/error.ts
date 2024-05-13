/*
 * error.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { mappedIndexToLineCol } from "./mapped-text";
import { lines } from "./text";
import { MappedString, Range } from "./types";
import { quotedStringColor } from "tidyverse-errors";

export class InternalError extends Error {
  constructor(
    message: string,
    printName = true,
    printStack = true,
  ) {
    super(message);
    this.name = "Internal Error";
    this.printName = printName;
    this.printStack = printStack;
  }

  public readonly printName: boolean;
  public readonly printStack: boolean;
}

export class UnreachableError extends InternalError {
  constructor() {
    super("Unreachable code was reached.", true, true);
  }
}

export class ErrorEx extends Error {
  constructor(
    name: string,
    message: string,
    printName = true,
    printStack = true,
  ) {
    super(message);
    this.name = name;
    this.printName = printName;
    this.printStack = printStack;
  }

  public readonly printName: boolean;
  public readonly printStack: boolean;
}

export function asErrorEx(e: unknown) {
  if (e instanceof ErrorEx) {
    return e;
  } else if (e instanceof Error) {
    // amend this error rather than creating a new ErrorEx
    // so that the stack trace survives

    /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    (e as any).printName = e.name !== "Error";
    /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    (e as any).printStack = !!e.message;
    return e as ErrorEx;
  } else {
    return new ErrorEx("Error", String(e), false, true);
  }
}

export function formatLineRange(
  text: string,
  firstLine: number,
  lastLine: number,
) {
  const lineWidth = Math.max(
    String(firstLine + 1).length,
    String(lastLine + 1).length,
  );
  const pad = " ".repeat(lineWidth);

  const ls = lines(text);

  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = `${pad}${i + 1}: `.slice(-(lineWidth + 2));
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + quotedStringColor(lineStr),
      rawLine: ls[i],
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result,
  };
}


/**
 * Create a formatted string describing the surroundings of an error.
 * Used in the generation of nicely-formatted error messages.
 *
 * @param src the string containing the source of the error
 * @param location the location range in src
 * @returns a string containing a formatted description of the context around the error
 */
export function createSourceContext(
  src: MappedString,
  location: Range,
): string {
  if (src.value.length === 0) {
    // if the file is empty, don't try to create a source context
    return "";
  }
  const startMapResult = src.map(location.start, true);
  const endMapResult = src.map(location.end, true);

  const locF = mappedIndexToLineCol(src);

  let sourceLocation;
  try {
    sourceLocation = {
      start: locF(location.start),
      end: locF(location.end),
    };
  } catch (_e) {
    sourceLocation = {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    };
  }

  if (startMapResult === undefined || endMapResult === undefined) {
    throw new InternalError(
      `createSourceContext called with bad location ${location.start}-${location.end}.`,
    );
  }

  if (startMapResult.originalString !== endMapResult.originalString) {
    throw new InternalError(
      "don't know how to create source context across different source files",
    );
  }
  const originalString = startMapResult.originalString;
  // TODO this is computed every time, might be inefficient on large files.
  const nLines = lines(originalString.value).length;

  const {
    start,
    end,
  } = sourceLocation;
  const {
    prefixWidth,
    lines: formattedLines,
  } = formatLineRange(
    originalString.value,
    Math.max(0, start.line - 1),
    Math.min(end.line + 1, nLines - 1),
  );
  const contextLines: string[] = [];
  let mustPrintEllipsis = true;
  for (const { lineNumber, content, rawLine } of formattedLines) {
    if (lineNumber < start.line || lineNumber > end.line) {
      if (rawLine.trim().length) {
        contextLines.push(content);
      }
    } else {
      if (
        lineNumber >= start.line + 2 && lineNumber <= end.line - 2
      ) {
        if (mustPrintEllipsis) {
          mustPrintEllipsis = false;
          contextLines.push("...");
        }
      } else {
        const startColumn = lineNumber > start.line ? 0 : start.column;
        const endColumn = lineNumber < end.line ? rawLine.length : end.column;
        contextLines.push(content);
        contextLines.push(
          " ".repeat(prefixWidth + startColumn - 1) +
            "~".repeat(endColumn - startColumn + 1),
        );
      }
    }
  }
  return contextLines.join("\n");
}
