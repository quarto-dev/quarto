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

import path from 'path';
import process from 'process';
import { createServer } from './server';


// development mode?
const development = process.env.NODE_ENV !== 'production';

// resource dirs
const cwd = process.cwd();
const editorDevResourcesDir = path.normalize(path.join(cwd, "../../packages/editor-server/src/resources"));
const editorResourcesDir = development ? editorDevResourcesDir : editorDevResourcesDir;
const devResourcesDir = path.normalize(path.join(cwd, "src", "resources"));
const resourcesDir = development ? devResourcesDir : devResourcesDir;


// configure server
const server = createServer(resourcesDir, editorResourcesDir);

// listen
const port = process.env.PORT || 5001;
server.listen(port, () => {
  console.log(`api running on ${port}`);
});
