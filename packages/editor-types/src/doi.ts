/*
 * doi.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { CSL } from "./csl";

export const kDoiFetchCsl = 'doi_fetch_csl';

export interface DOIResult {
    status: 'ok' | 'notfound' | 'nohost' | 'error';
    message: CSL | null;
    error: string;
}

export interface DOIServer {
    fetchCSL: (doi: string) => Promise<DOIResult>;
}


