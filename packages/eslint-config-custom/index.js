import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig({
  files: ["**/*.{ts,tsx,mts,cts}"],
  extends: [js.configs.recommended, tseslint.configs.recommended, prettier],
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    globals: { ...globals.browser },
  },
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
    // A leading underscore marks a binding as intentionally unused
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
    ],
    // `import x = require("x")` is how the `declare module` shims pull in types
    "@typescript-eslint/no-require-imports": ["error", { allowAsImport: true }],
  },
});
