/*
 * command-permissions.ts
 *
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import type { WorkspaceConfiguration } from "vscode";

// Return a decision rather than showing notifications or executing commands.
// The webview handler owns presentation; this function owns the permission
// policy. Distinct denial reasons let the handler explain what blocked a click.
export type PreviewCommandPermission =
  | "allowed"
  | "untrusted-workspace"
  | "invalid-configuration"
  | "not-allowed";

/**
 * Decide whether one command ID is permitted at the time of a click.
 *
 * The caller must supply the current workspace trust state and a fresh result
 * of configuration.inspect("allowedCommands"). Nothing is cached here: removing
 * permission or changing trust must affect the next invocation. This function
 * does not parse command arguments or establish that a browser message came
 * from the correct preview; those are separate checks before dispatch.
 */
export function previewCommandPermission(
  commandId: string,
  isTrusted: boolean,
  setting: ReturnType<WorkspaceConfiguration["inspect"]>
): PreviewCommandPermission {
  // Trust and the allowlist are independent requirements. An explicit entry
  // must never allow a command to run in an untrusted workspace.
  if (!isTrusted) {
    return "untrusted-workspace";
  }

  // globalValue is the User/Remote User value supplied by the extension host.
  const allowed: unknown = setting?.globalValue === undefined ? [] : setting.globalValue;
  // Treat settings as untrusted runtime data despite the package.json schema:
  // users can edit JSON directly. Reject the whole list if any entry is invalid
  if (
    !Array.isArray(allowed) ||
    !allowed.every(id => typeof id === "string" && /^\S+$/.test(id))
  ) {
    return "invalid-configuration";
  }

  // includes() compares the complete, case-sensitive ID. Entries such as "*"
  // or "vscode.*" have no wildcard meaning and cannot authorize vscode.open.
  // This decision concerns the ID only; it does not constrain command arguments
  // or make an allowed command's side effects safe.
  return allowed.includes(commandId) ? "allowed" : "not-allowed";
}
