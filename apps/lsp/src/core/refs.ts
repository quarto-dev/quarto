import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver-types";
import { isContentPosition } from "./markdown/markdown";

export function bypassRefIntelligence(
  doc: TextDocument,
  pos: Position,
  line: string
): boolean {
  // bypass if the current line doesn't contain a @
  // (performance optimization so we don't execute the regexs
  // below if we don't need to)
  if (line.indexOf("@") === -1) {
    return true;
  }

  // ensure we have the file scheme
  if (!doc.uri.startsWith("file:")) {
    return true;
  }

  // check if we are in markdown
  if (!isContentPosition(doc, pos)) {
    return true;
  }

  return false;
}
