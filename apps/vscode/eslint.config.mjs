import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";

export default defineConfig(
  // `**/*.js` keeps the old `--ext ts` behavior (e.g. skips src/test/fixtures/*.js)
  { ignores: ["out/**", "dist/**", "**/*.d.ts", "**/*.js"] },
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tseslint.parser, sourceType: "module" },
    plugins: { "@typescript-eslint": tseslint.plugin, "@stylistic": stylistic },
    rules: {
      "@typescript-eslint/naming-convention": "warn",
      "@stylistic/semi": "warn",
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
    },
  },
);
