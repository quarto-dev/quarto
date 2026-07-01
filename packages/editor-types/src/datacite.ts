/*
 * datacite.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export const kDataCiteSearch = 'datacite_search';

export interface DataCiteResult {
  status: 'ok' | 'notfound' | 'nohost' | 'error';
  message: DataCiteRecord[] | null;
  error: string;
}

export interface DataCiteRecord {
  doi: string;
  title?: string;
  publisher?: string;
  publicationYear?: number;
  creators?: DataCiteCreator[];
  type?: string; // citeproc type
}

export interface DataCiteCreator {
  fullName: string;
  familyName?: string;
  givenName?: string;
}

export interface DataCiteServer {
  search: (query: string) => Promise<DataCiteResult>;
}

