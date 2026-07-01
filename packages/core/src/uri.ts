/*
 * uri.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

export function tryDecodeUri(str: string): string {
	try {
		return decodeURI(str);
	} catch {
		return str;
	}
}
