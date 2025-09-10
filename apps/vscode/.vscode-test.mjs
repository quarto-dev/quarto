import { defineConfig } from '@vscode/test-cli';
import { execSync } from 'child_process';

const quartoPath = execSync('which quarto', {
  encoding: 'utf-8'
}).trim();

const quartoVersion = execSync(`${quartoPath} --version`, {
  encoding: 'utf-8',
}).trim();

console.info(`
========================================
Quarto Path:     ${quartoPath}
Quarto Version:  ${quartoVersion}
========================================
`);

export default defineConfig([
  {
    files: 'test-out/*.test.js',
    workspaceFolder: 'src/test/examples',
    mocha: {
      timeout: 5000,
    },
  },
]);
