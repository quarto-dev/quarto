import custom from "eslint-config-custom";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig(custom, {
  files: ["**/*.{ts,tsx,mts,cts}"],
  languageOptions: {
    ecmaVersion: "latest",
    globals: { ...globals.node },
  },
});
