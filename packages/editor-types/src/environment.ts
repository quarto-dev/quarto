/*
 * environment.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export const kEnvironmentGetRPackageState = 'environment_get_r_package_state';
export const kEnvironmentGetRPackageCitations = 'environment_get_r_package_citations';

export interface EnvironmentServer {
  getRPackageState: () => Promise<RPackageState>;
  getRPackageCitations: (pkgName: string) => Promise<RPackageCitation[]>;
}

export interface RPackageState {
  package_list: RPackageInfo[];
}

export interface RPackageInfo {
  name: string;
  version: string | null;
  desc: string | null;
}

// https://stat.ethz.ch/R-manual/R-devel/library/utils/html/bibentry.html
export interface RPackageCitation {
  type: string;
  author: RPackageCitationPerson[];
  editor?: RPackageCitationPerson[];
  title: string;
  doi?: string;
  url?: string;
  note?: string;
  publisher?: string;
  institution?: string;
  adddress?: string;
  journal?: string;
  year?: string;
  booktitle?: string;
  chapter?: string;
  number?: string;
  volume?: string;
  pages?: string;
  series?: string;
  school?: string;
}

// https://stat.ethz.ch/R-manual/R-devel/library/utils/html/person.html
export interface RPackageCitationPerson {
  given: string[];
  family: string;
  email?: string;
  role?: string;
}