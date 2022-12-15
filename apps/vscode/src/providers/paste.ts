/* eslint-disable @typescript-eslint/naming-convention */
/*
 * pate.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2017 张宇
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */


import { window, commands, env } from "vscode";

import { Command } from "../core/command";

export function activatePaste() {
  return [new QuartoPasteCommand()];
}

export class QuartoPasteCommand implements Command {
  constructor() {}
  private static readonly id = "quarto.paste";
  public readonly id = QuartoPasteCommand.id;

  async execute() {
    const editor = window.activeTextEditor!;
    const selection = editor.selection;
    if (
      selection.isSingleLine &&
      !isSingleLink(editor.document.getText(selection))
    ) {
      const text = await env.clipboard.readText();
      if (isSingleLink(text)) {
        return commands.executeCommand("editor.action.insertSnippet", {
          snippet: `[$TM_SELECTED_TEXT$0](${text})`,
        });
      }
    }
    return commands.executeCommand("editor.action.clipboardPasteAction");
  }
}

/**
 * Checks if the string is a link. This code ported from django's
 * [URLValidator](https://github.com/django/django/blob/2.2b1/django/core/validators.py#L74)
 * with some simplifiations.
 */

function isSingleLink(text: string): boolean {
  return singleLinkRegex.test(text);
}
const singleLinkRegex: RegExp = createLinkRegex();

function createLinkRegex(): RegExp {
  // unicode letters range(must not be a raw string)
  const ul = "\\u00a1-\\uffff";
  // IP patterns
  const ipv4_re =
    "(?:25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}";
  const ipv6_re = "\\[[0-9a-f:\\.]+\\]"; // simple regex (in django it is validated additionally)

  // Host patterns
  const hostname_re =
    "[a-z" + ul + "0-9](?:[a-z" + ul + "0-9-]{0,61}[a-z" + ul + "0-9])?";
  // Max length for domain name labels is 63 characters per RFC 1034 sec. 3.1
  const domain_re = "(?:\\.(?!-)[a-z" + ul + "0-9-]{1,63}(?<!-))*";

  const tld_re =
    "" +
    "\\." + // dot
    "(?!-)" + // can't start with a dash
    "(?:[a-z" +
    ul +
    "-]{2,63}" + // domain label
    "|xn--[a-z0-9]{1,59})" + // or punycode label
    "(?<!-)" + // can't end with a dash
    "\\.?"; // may have a trailing dot
  const host_re = "(" + hostname_re + domain_re + tld_re + "|localhost)";
  const pattern =
    "" +
    "^(?:[a-z0-9\\.\\-\\+]*)://" + // scheme is not validated (in django it is validated additionally)
    "(?:[^\\s:@/]+(?::[^\\s:@/]*)?@)?" + // user: pass authentication
    "(?:" +
    ipv4_re +
    "|" +
    ipv6_re +
    "|" +
    host_re +
    ")" +
    "(?::\\d{2,5})?" + // port
    "(?:[/?#][^\\s]*)?" + // resource path
    "$"; // end of string
  return new RegExp(pattern, "i");
}
