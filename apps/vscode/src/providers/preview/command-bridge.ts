/*
 * command-bridge.ts
 *
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import * as tmp from "tmp";

export interface PreviewCommandBridge {
  // The manager passes the token to the webview and the metadata path to Quarto.
  // Both belong to one running preview, including its subsequent live renders.
  readonly token: string;
  readonly metadataFile: string;
  dispose(): void;
}

// Lua long strings preserve quotes, backslashes and Unicode in the script.
function luaString(value: string): string {
  let separator = "";
  // Increase the delimiter until script text cannot close the Lua string early.
  while (value.includes(`]${separator}]`)) {
    separator += "=";
  }
  return `[${separator}[${value}]${separator}]`;
}

/**
 * Add the click bridge to HTML previews without replacing authored includes.
 *
 * Quarto CLI's existing document-side relay sends only the clicked URL, losing
 * the anchor's data-args attribute. The extension receives that message, not the
 * DOM click: clicks do not bubble out of an iframe, and the different origins
 * prevent the outer webview from reading the document's anchor directly.
 *
 * Injecting our own document-side handler preserves href and data-args without
 * requiring a modified CLI. The temporary metadata/Lua filter adds that handler
 * during rendering without editing the user's document or project settings.
 * A cleaner long-term solution is to extend the CLI's existing relay to forward
 * data-args alongside the URL. Adopting that protocol would require a compatible
 * CLI version and corresponding extension changes, allowing this injection to
 * be removed where the CLI provides the needed behavior.
 */
export function createPreviewCommandBridge(extensionRoot: string): PreviewCommandBridge {
  // Read from the installed extension so rendering needs no project-side files.
  const script = fs.readFileSync(path.join(extensionRoot, "assets", "www", "preview", "command-links.js"), "utf8");
  const directory = tmp.dirSync({ prefix: "quarto-command-bridge-", unsafeCleanup: true });
  // A fresh token identifies this invocation even when code-server proxies
  // several preview servers under the same browser origin. It grants no command
  // permission; the host still checks workspace trust and User settings.
  const token = randomUUID();
  const metadataFile = path.join(directory.name, "metadata.json");
  try {
    // HTML closes script elements before JavaScript is parsed. Escape closing
    // tags in the asset before embedding it, independently of Lua quoting.
    const html = `<script data-quarto-command-token="${token}">\n${script.replace(/<\/script/gi, "<\\/script")}\n</script>`;
    const filterFile = path.join(directory.name, "command-links.lua");
    // A raw HTML block leaves PDF and other non-HTML writers untouched, and
    // does not force HTML over an authored Reveal.js or project format.
    fs.writeFileSync(filterFile, `
function Pandoc(doc)
  if FORMAT:match("^html") or FORMAT == "revealjs" then
    doc.blocks:insert(pandoc.RawBlock("html", ${luaString(html)}))
  end
  return doc
end
`, { mode: 0o600 });
    // Quarto merges this filter with authored configuration. Keep these files
    // until disposal because save-triggered renders need to read them again.
    fs.writeFileSync(metadataFile, JSON.stringify({ filters: [filterFile] }), { mode: 0o600 });
    return { token, metadataFile, dispose: () => directory.removeCallback() };
  } catch (error) {
    // Failed setup must not leave a partial filter or metadata directory behind.
    directory.removeCallback();
    throw error;
  }
}

export interface PreviewCommandMessage {
  type: "quarto.preview.command";
  token: string;
  origin: string;
  link: { href: string; dataArgs?: string };
}

/** Recheck the browser relay's session and payload before dispatching anything. */
export function isPreviewCommandMessage(
  value: unknown,
  expectedToken: string | undefined,
  previewUrl: string
): value is PreviewCommandMessage {
  // An absent token means this preview has no bridge or its session was revoked.
  if (!expectedToken || !value || typeof value !== "object") {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (message.type !== "quarto.preview.command" || message.token !== expectedToken || typeof message.origin !== "string") {
    return false;
  }
  try {
    // The relay supplies the browser event's origin. Compare it with the
    // manager's preview URL, rather than accepting an origin from link content.
    const url = new URL(previewUrl);
    if (!/^https?:$/.test(url.protocol) || message.origin !== url.origin) {
      return false;
    }
  } catch {
    // A malformed preview address cannot authorize a relay message.
    return false;
  }
  // This checks the transport shape only. The dispatcher still validates the
  // command URI, argument sources and live permission before executing anything.
  if (!message.link || typeof message.link !== "object" || Array.isArray(message.link)) {
    return false;
  }
  const link = message.link as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(link, "href") && typeof link.href === "string" &&
    (!Object.prototype.hasOwnProperty.call(link, "dataArgs") || typeof link.dataArgs === "string");
}
