/*
 * bibliojson-types.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

// Types for the BibDB structures we build and consume. bibliojson
// (https://github.com/fiduswriter/BiblioJSON) declares these internally but
// doesn't export them, so we keep our own copies here.

import { BibFieldTypes, BibTypes } from 'bibliojson';

export type BibType = (typeof BibTypes)[string];
export type BibField = (typeof BibFieldTypes)[string];

export type MarkObject = {
  type: string;
};

type OtherNodeObject = {
  type: string;
  marks?: Array<MarkObject>;
  attrs?: Record<string, unknown>;
};

export type TextNodeObject = {
  type: 'text';
  text: string;
  marks?: Array<MarkObject>;
  attrs?: Record<string, unknown>;
};

export type NodeObject = OtherNodeObject | TextNodeObject;
export type NodeArray = Array<NodeObject>;

export type NameDictObject = {
  literal?: NodeArray;
  family?: NodeArray;
  given?: NodeArray;
  prefix?: NodeArray;
  suffix?: NodeArray;
  useprefix?: boolean;
};

export type RangeArray = [NodeArray, NodeArray] | [NodeArray];
