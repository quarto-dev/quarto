// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/*
 * languages.ts
 *
 * Copyright (C) 2022 by Emergence Engineering (ISC License)
 * https://gitlab.com/emergence-engineering/prosemirror-codemirror-block
 * 
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { StreamLanguage } from "@codemirror/language";
import { LanguageLoaders } from "./types";

export enum Languages {
  javascript = "javascript",
  html = "html",
  css = "css",
  sql = "sql",
  python = "python",
  rust = "rust",
  xml = "xml",
  markdown = "markdown",
  cpp = "cpp",
  clike = "clike",
  fortran = "fortran",
  haskell = "haskell",
  julia = "julia",
  lua = "lua",
  powershell = "powershell",
  r = "r",
  ruby = "ruby",
  sas = "sas",
  shell = "shell",
  stex = "stex",
  yaml = "yaml",
}


export const languageLoaders: LanguageLoaders = {
  [Languages.cpp]: () =>
    import("@codemirror/lang-cpp").then((i) => i.cpp()),
  [Languages.css]: () =>
    import("@codemirror/lang-css").then((i) => i.css()),
  [Languages.html]: () =>
    import("@codemirror/lang-html").then((i) => i.html()),
  [Languages.sql]: () =>
    import("@codemirror/lang-sql").then((i) => i.sql()),
  [Languages.xml]: () =>
    import("@codemirror/lang-xml").then((i) => i.xml()),
  [Languages.javascript]: () =>
    import("@codemirror/lang-javascript").then((i) => i.javascript()),
  [Languages.markdown]: () =>
    import("@codemirror/lang-markdown").then((i) => i.markdown()),
  [Languages.python]: () =>
    import("@codemirror/lang-python").then((i) => i.python()),
  [Languages.rust]: () =>
    import("@codemirror/lang-rust").then((i) => i.rust()),
  [Languages.clike]: () =>
    import("@codemirror/legacy-modes/mode/clike").then(({ clike }) =>
      StreamLanguage.define(clike)
    ),
  [Languages.fortran]: () =>
    import("@codemirror/legacy-modes/mode/fortran").then(({ fortran }) =>
      StreamLanguage.define(fortran)
    ),
  [Languages.haskell]: () =>
    import("@codemirror/legacy-modes/mode/haskell").then(({ haskell }) =>
      StreamLanguage.define(haskell)
    ),
  [Languages.julia]: () =>
    import("@codemirror/legacy-modes/mode/julia").then(({ julia }) =>
      StreamLanguage.define(julia)
    ),
  [Languages.lua]: () =>
    import("@codemirror/legacy-modes/mode/lua").then(({ lua: legacyLua }) =>
      StreamLanguage.define(legacyLua)
    ),
  [Languages.powershell]: () =>
    import("@codemirror/legacy-modes/mode/powershell").then(({ powerShell }) =>
      StreamLanguage.define(powerShell)
    ),
  [Languages.r]: () =>
    import("@codemirror/legacy-modes/mode/r").then(({ r }) =>
      StreamLanguage.define(r)
    ),
  [Languages.ruby]: () =>
    import("@codemirror/legacy-modes/mode/ruby").then(({ ruby }) =>
      StreamLanguage.define(ruby)
    ),
  [Languages.sas]: () =>
    import("@codemirror/legacy-modes/mode/sas").then(({ sas }) =>
      StreamLanguage.define(sas)
    ),
  [Languages.shell]: () =>
    import("@codemirror/legacy-modes/mode/shell").then(({ shell }) =>
      StreamLanguage.define(shell)
    ),
  [Languages.stex]: () =>
    import("@codemirror/legacy-modes/mode/stex").then(({ stex }) =>
      StreamLanguage.define(stex)
    ),
  [Languages.yaml]: () =>
    import("@codemirror/legacy-modes/mode/yaml").then(({ yaml }) =>
      StreamLanguage.define(yaml)
    )
};



