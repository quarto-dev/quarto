/*
 * index.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import fs from 'node:fs'
import path from 'node:path';
import process from 'node:process';
import { initQuartoContext } from 'quarto-core';
import { createServer } from './server';


// development mode?
const development = process.env.NODE_ENV !== 'production';

// resource dirs
// TODO: we currently don't copy resources from quarto-core
const cwd = process.cwd();
const editorDevResourcesDir = path.normalize(path.join(cwd, "../../packages/editor-server/src/resources"));
const editorResourcesDir = development ? editorDevResourcesDir : editorDevResourcesDir;

// copy quarto-core dependenciers to resource dir
const quartoCoreResourcesdir = path.normalize(path.join(cwd, "../../packages/quarto-core/src/resources"));
for (const file of fs.readdirSync(quartoCoreResourcesdir)) {
  const match = file.match(/^.*\.lua$/);
  if (match) {
    fs.copyFileSync(path.join(quartoCoreResourcesdir, file), path.join(editorResourcesDir, file));
  }
}

// configure server
const quartoContext = initQuartoContext();
const server = createServer(quartoContext, editorResourcesDir);

// listen
const port = process.env.PORT || 5001;
server.listen(port, () => {
  console.log(`api running on ${port}`);
});
