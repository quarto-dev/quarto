/*
 * platform.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export const kPlatformMac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false;
