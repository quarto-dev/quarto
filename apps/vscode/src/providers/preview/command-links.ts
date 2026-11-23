/*
 * command-links.ts
 *
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import type { PreviewCommandPermission } from "./command-permissions";

export interface ParsedPreviewCommand {
  commandId: string;
  args: unknown[];
}

export type PreviewCommandErrorCode =
  | "invalid-link"
  | "conflicting-arguments"
  | "invalid-arguments"
  | "invalid-uri";

const errorMessages = new Map<PreviewCommandErrorCode, string>([
  ["invalid-link", "Invalid preview command link."],
  ["conflicting-arguments", "Preview command arguments must use either the URL query or data-args, not both."],
  ["invalid-arguments", "Preview command arguments must be a JSON array."],
  ["invalid-uri", "Invalid URI argument in preview command link."],
]);

// Fixed messages prevent parser exceptions from revealing argument contents.
export class PreviewCommandError extends Error {
  constructor(public readonly code: PreviewCommandErrorCode) {
    super(errorMessages.get(code) ?? "Invalid preview command link.");
    this.name = "PreviewCommandError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parse a raw href plus an optional, unmodified dataArgs attribute value. */
export function parsePreviewCommandLink(link: unknown): ParsedPreviewCommand {
  // Require an own string field and reject control characters before matching;
  // URI normalization could otherwise hide malformed document-provided text.
  if (!isRecord(link) || !Object.prototype.hasOwnProperty.call(link, "href") || typeof link.href !== "string" || /\p{Cc}/u.test(link.href)) {
    throw new PreviewCommandError("invalid-link");
  }

  // Parse the raw URI so an empty query stays distinguishable from no query.
  // Fragments and authorities are not part of a command invocation.
  const match = /^command:([^?#]+)(?:\?([^#]*))?$/i.exec(link.href);
  if (!match || match[1].startsWith("//")) {
    throw new PreviewCommandError("invalid-link");
  }

  let commandId: string;
  try {
    // Decode an encoded ID before exact allowlist matching; retain its case.
    commandId = decodeURIComponent(match[1]);
  } catch {
    throw new PreviewCommandError("invalid-link");
  }
  if (/[\s\p{Cc}]/u.test(commandId)) {
    throw new PreviewCommandError("invalid-link");
  }

  // Presence matters: even empty attributes and queries conflict with each other.
  const hasQuery = match[2] !== undefined;
  const hasDataArgs = Object.prototype.hasOwnProperty.call(link, "dataArgs");
  if (hasQuery && hasDataArgs) {
    throw new PreviewCommandError("conflicting-arguments");
  }
  if (!hasQuery && !hasDataArgs) {
    return { commandId, args: [] };
  }

  let args: unknown;
  try {
    if (hasDataArgs && typeof link.dataArgs !== "string") {
      throw new PreviewCommandError("invalid-arguments");
    }
    // Queries are encoded JSON, not form data. Decode once and preserve plus.
    // DOM attribute values are already decoded HTML and need only JSON parsing.
    const json = hasQuery ? decodeURIComponent(match[2]) : link.dataArgs as string;
    args = JSON.parse(json);
  } catch {
    throw new PreviewCommandError("invalid-arguments");
  }
  if (!Array.isArray(args)) {
    throw new PreviewCommandError("invalid-arguments");
  }
  return { commandId, args };
}

// Only these standard components are passed to the host's Uri.from function.
export interface PreviewUriComponents {
  scheme: string;
  authority?: string;
  path?: string;
  query?: string;
  fragment?: string;
}

/** Revive only top-level URI arguments; leave nested command arguments alone. */
export function revivePreviewCommandArguments(
  args: unknown[],
  createUri: (components: PreviewUriComponents) => unknown
): unknown[] {
  return args.map(arg => {
    if (!isRecord(arg) || typeof arg.scheme !== "string" || (arg.$mid !== undefined && arg.$mid !== 1)) {
      return arg;
    }

    // Require a real URI scheme rather than letting an empty scheme default to file.
    if (!/^[a-z][a-z0-9+.-]*$/i.test(arg.scheme)) {
      throw new PreviewCommandError("invalid-uri");
    }
    const components: PreviewUriComponents = { scheme: arg.scheme };
    for (const field of ["authority", "path", "query", "fragment"] as const) {
      if (arg[field] !== undefined) {
        if (typeof arg[field] !== "string") {
          throw new PreviewCommandError("invalid-uri");
        }
        components[field] = arg[field];
      }
    }

    // Copy known components only, and never expose a raw URI construction error.
    try {
      return createUri(components);
    } catch {
      throw new PreviewCommandError("invalid-uri");
    }
  });
}

export interface PreviewCommandDispatchHost {
  // Inject editor APIs so parsing stays testable without loading VS Code.
  // permission is a callback to avoid caching a grant when the preview opens.
  createUri: (components: PreviewUriComponents) => unknown;
  permission: (commandId: string) => PreviewCommandPermission;
  executeCommand: (commandId: string, ...args: unknown[]) => PromiseLike<unknown>;
}

export type PreviewCommandDispatchResult =
  | { status: "executed" }
  | { status: "blocked"; permission: Exclude<PreviewCommandPermission, "allowed"> }
  | { status: "invalid"; reason: PreviewCommandErrorCode }
  | { status: "failed" };

/** Validate the complete invocation before authorizing and executing its command. */
export async function dispatchPreviewCommand(
  link: unknown,
  host: PreviewCommandDispatchHost
): Promise<PreviewCommandDispatchResult> {
  let commandId: string;
  let commandArgs: unknown[];
  try {
    const parsed = parsePreviewCommandLink(link);
    commandId = parsed.commandId;
    commandArgs = revivePreviewCommandArguments(parsed.args, host.createUri);
  } catch (error) {
    return {
      status: "invalid",
      reason: error instanceof PreviewCommandError ? error.code : "invalid-link",
    };
  }

  try {
    // Check current permission immediately before execution, with no await between.
    // Only the requested ID is checked, including when it is runCommands.
    const permission = host.permission(commandId);
    if (permission !== "allowed") {
      return { status: "blocked", permission };
    }
    await host.executeCommand(commandId, ...commandArgs);
    return { status: "executed" };
  } catch {
    // Command failures and return values may contain secrets; expose neither.
    return { status: "failed" };
  }
}
