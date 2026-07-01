/*
 * position.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { Position as VSCodePosition } from 'vscode-languageserver-types';

export type Position = VSCodePosition;

export function arePositionsEqual(a: Position, b: Position): boolean {
	return a.line === b.line && a.character === b.character;
}

export function isPosition(other: unknown): other is Position {
	if (!other) {
		return false;
	}

	const { line, character } = <Position>other;
	return typeof line === 'number' && typeof character === 'number';
}

export function translatePosition(pos: Position, change: { lineDelta?: number; characterDelta?: number }): Position {
	return {
		line: pos.line + (change.lineDelta ?? 0),
		character: pos.character + (change.characterDelta ?? 0),
	};
}

export function isBefore(pos: Position, other: Position): boolean {
	if (pos.line < other.line) {
		return true;
	}
	if (other.line < pos.line) {
		return false;
	}
	return pos.character < other.character;
}

export function isBeforeOrEqual(pos: Position, other: Position): boolean {
	if (pos.line < other.line) {
		return true;
	}
	if (other.line < pos.line) {
		return false;
	}
	return pos.character <= other.character;
}

export function isAfter(pos: Position, other: Position): boolean {
	return !isBeforeOrEqual(pos, other);
}

export function comparePosition(a: Position, b: Position): number {
	if (a.line < b.line) {
		return -1;
	} else if (a.line > b.line) {
		return 1;
	} else {
		// equal line
		if (a.character < b.character) {
			return -1;
		} else if (a.character > b.character) {
			return 1;
		} else {
			// equal line and character
			return 0;
		}
	}
}