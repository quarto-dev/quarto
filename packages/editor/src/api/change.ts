/*
 * diff.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { diff_match_patch, DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from 'diff-match-patch';

export enum EditorChangeType {
  Insert = 1,
  Equal = 0,
  Delete = -1,
}

export interface EditorChange {
  type: EditorChangeType;
  value: string;
}

export function diffChars(from: string, to: string, timeout: number): EditorChange[] {
  const dmp = new diff_match_patch();
  dmp.Diff_Timeout = timeout;
  const diff = dmp.diff_main(from, to);
  dmp.diff_cleanupSemantic(diff);
  return diff.map(d => {
    let type: EditorChangeType;
    switch (d[0]) {
      case DIFF_INSERT:
        type = EditorChangeType.Insert;
        break;
      case DIFF_EQUAL:
        type = EditorChangeType.Equal;
        break;
      case DIFF_DELETE:
        type = EditorChangeType.Delete;
        break;
      default:
        throw new Error('Unexpected diff type: ' + d[0]);
    }
    return {
      type,
      value: d[1],
    };
  });
}
