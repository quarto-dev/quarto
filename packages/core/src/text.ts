/*
 * text.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}

export function capitalizeWord(str: string) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

export function capitalizeTitle(str: string) {
  return str.split(/\s+/).map((str, index, arr) => {
    if (
      index === 0 || index === (arr.length - 1) || !isNotCapitalized(str)
    ) {
      return capitalizeWord(str);
    } else {
      return str;
    }
  }).join(" ");
}

function isNotCapitalized(str: string) {
  return [
    // articles
    "a",
    "an",
    "the",
    // coordinating conjunctions
    "for",
    "and",
    "nor",
    "but",
    "or",
    "yet",
    "so",
    // prepositions
    "with",
    "at",
    "by",
    "to",
    "in",
    "for",
    "from",
    "of",
    "on",
  ].includes(str);
}


export function stripQuotes(text: string) {
  return text.replace(/["']/g, '');
}

export function equalsIgnoreCase(str1: string, str2: string) {
  if (!str1 && !!str2) {
    return false;
  } else if (!!str1 && !str2) {
    return false;
  } else if (str1 === str2) {
    return true;
  } else {
    return str1.localeCompare(str2, undefined, { sensitivity: 'accent' }) === 0;
  }
}


export function trimEmptyLines(
  lines: string[],
  trim: "leading" | "trailing" | "all" = "all",
) {
  // trim leading lines
  if (trim === "all" || trim === "leading") {
    const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0);
    if (firstNonEmpty === -1) {
      return [];
    }
    lines = lines.slice(firstNonEmpty);
  }

  // trim trailing lines
  if (trim === "all" || trim === "trailing") {
    let lastNonEmpty = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) {
        lastNonEmpty = i;
        break;
      }
    }
    if (lastNonEmpty > -1) {
      lines = lines.slice(0, lastNonEmpty + 1);
    }
  }

  return lines;
}
