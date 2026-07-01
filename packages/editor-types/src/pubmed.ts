/*
 * pubmed.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export const kPubMedSearch = 'pubmed_search';

export interface PubMedResult {
  status: 'ok' | 'notfound' | 'nohost' | 'error';
  message: PubMedDocument[] | null;
  error: string;
}

export interface PubMedDocument {
  doi: string;
  pubTypes?: string[];
  authors?: string[];
  sortFirstAuthor?: string;
  title?: string;
  source?: string;
  volume?: string;
  issue?: string;
  pubDate?: string;
}

export interface PubMedServer {
  search: (query: string) => Promise<PubMedResult>;
}

