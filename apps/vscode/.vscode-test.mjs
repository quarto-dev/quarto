import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
  {
    files: 'test-out/*.test.js',
    workspaceFolder: 'src/test/examples',
    mocha: {
      timeout: 5000,
    },
  },
  // R project workspace
  {
    label: 'r-project',
    files: 'test-out/r-project.test.js',
    workspaceFolder: 'src/test/examples/r-project',
    mocha: {
      timeout: 5000,
    },
  },
]);
