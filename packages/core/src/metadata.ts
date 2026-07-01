/*
 * metadata.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export type Metadata = {
  [key: string]: unknown;
};


export function metadataFromKeyvalueText(
  text: string,
  separator: " " | "\n",
): Metadata {
  // if the separator is a space then convert unquoted spaces to newline
  if (separator === " ") {
    let convertedText = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      let ch = text.charAt(i);
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === " " && !inQuotes) {
        ch = "\n";
      }
      convertedText += ch;
    }
    text = convertedText;
  }

  const lines = text.trim().split("\n");
  const metadata: Metadata = {};
  lines.forEach((line) => {
    const parts = line.trim().split("=");
    metadata[parts[0]] = (parts[1] || "").replace(/^"/, "").replace(/"$/, "");
  });
  return metadata;
}

