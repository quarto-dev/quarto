import node from "@rollup/plugin-node-resolve";
import {terser} from "rollup-plugin-terser";
import * as meta from "./package.json";

const copyright = `// @quarto/external-observablehq-stdlib ${meta.version} Fork changes are Copyright ${(new Date).getFullYear()} RStudio, PBC.\n // @observablehq/stdlib v${meta.version} Copyright ${(new Date).getFullYear()} Observable, Inc.`;

export default [
  {
    input: "src/index.mjs",
    plugins: [
      node(),
      terser({
        output: {preamble: copyright},
        mangle: {
          reserved: [
            "FileAttachment",
            "RequireError",
            "SQLiteDatabaseClient",
            "Workbook",
            "ZipArchive",
            "ZipArchiveEntry"
          ]
        }
      })
    ],
    output: {
      format: "es",
      extend: true,
      name: "observablehq",
      file: "dist/stdlib.js"
    }
  }
];
