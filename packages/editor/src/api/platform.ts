/*
 * platform.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export const kPlatformMac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false;
