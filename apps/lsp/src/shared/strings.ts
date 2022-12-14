/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function escapeRegExpCharacters(value: string): string {
  return value.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, "\\$&");
}

export function shQuote(value: string): string {
  if (/\s/g.test(value)) {
    return `"${value}"`;
  } else {
    return value;
  }
}

export function winShEscape(value: string): string {
  return value.replace(" ", "^ ");
}
