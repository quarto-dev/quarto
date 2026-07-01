/*
 * services.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import { CodeViewServer } from "./codeview";
import { DictionaryServer } from "./dictionary";
import { MathServer } from "./math";
import { PrefsServer } from "./prefs";
import { SourceServer } from "./source";


export interface EditorServices {
  readonly math: MathServer;
  readonly dictionary: DictionaryServer;
  readonly source: SourceServer;
  readonly prefs: PrefsServer;
  readonly codeview?: CodeViewServer;
}
