import custom from "eslint-config-custom";
import { defineConfig } from "eslint/config";

export default defineConfig(custom, {
  // The `declare module` shims define a namespace that is only referenced via
  // `typeof`, which typescript-eslint 8 reports as "only used as a type".
  files: ["src/@types/**/*.d.ts"],
  rules: {
    "@typescript-eslint/no-unused-vars": "off",
  },
});
