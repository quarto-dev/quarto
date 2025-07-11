import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
  {
    files: 'test-out/*.test.js',
    workspaceFolder: 'test/examples',
  },
]);
