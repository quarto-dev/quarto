import json from '@rollup/plugin-json';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/quarto-core-lib.js',
    format: 'es',
    inlineDynamicImports: true
  },
  plugins: [json()]
};