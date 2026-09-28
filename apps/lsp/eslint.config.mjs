import server from "eslint-config-custom-server";
import { defineConfig } from "eslint/config";

export default defineConfig(server, {
  files: ["**/*.ts"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
});
