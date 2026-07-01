/*
 * shortcode.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export const kShortcodePattern = '(?:^|[^`])({{([%<])\\s+.*?[%>]}})';
export const kShortcodeRegEx = new RegExp(kShortcodePattern, 'g');
