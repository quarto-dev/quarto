/*
 * arrays.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * @returns New array with all falsy values removed. The original array IS NOT modified.
 */
export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
	return <T[]>array.filter(e => !!e);
}
