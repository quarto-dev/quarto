import { defineConfig } from '@vscode/test-cli';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Use a short path for user-data-dir to avoid exceeding the 103-char Unix
// socket path limit on macOS when the repo lives in a deeply nested worktree.
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qvs-'));

/** @satisfies {Partial<import('@vscode/test-cli').IDesktopTestConfiguration>} */
const defaultConfig = {
  launchArgs: [`--user-data-dir=${userDataDir}`],
  mocha: {
    timeout: 5000,
  },
};

export default defineConfig([
  {
    ...defaultConfig,
    label: 'main',
    files: 'test-out/!(r-project).test.js',
    workspaceFolder: 'src/test/examples',
  },
  // R project workspace
  {
    ...defaultConfig,
    label: 'r-project',
    files: 'test-out/r-project.test.js',
    workspaceFolder: 'src/test/examples/r-project',
  },
]);
