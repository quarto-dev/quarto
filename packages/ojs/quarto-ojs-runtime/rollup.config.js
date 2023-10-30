import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";
import meta from "./package.json" assert { type: "json" };
import json from "@rollup/plugin-json";

const config = {
  input: "src/index.js",
  external: Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)),
  output: {
    file: "dist/quarto-ojs-runtime.js",
    name: "quarto",
    format: "esm",
    indent: false,
    extend: true,
    banner: `// ${meta.name} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`,
    globals: ["$", "Shiny"]
  },
  plugins: [json(), commonjs(), nodeResolve({
    mainFields: ["module", "main"],
  })]
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      file: "dist/quarto-ojs-runtime.min.js",
      name: "quarto-min",
    },
    plugins: [
      ...config.plugins,
      terser({
        mangle: {
          reserved: ["RequireError"]
        }
      }),
    ]
  }
];
