/*
 * datacite.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { DataCiteRecord } from 'editor-types';


export function suggestCiteId(record: DataCiteRecord): string {
  // Try to use the last name (or the first name)
  let suggestedId = '';
  if (record.creators && record.creators.length > 0) {
    suggestedId = record.creators[0].familyName || record.creators[0].fullName;
  }

  // Try to read the year
  if (record.publicationYear) {
    suggestedId = suggestedId + record.publicationYear;
  }
  return suggestedId;
}
