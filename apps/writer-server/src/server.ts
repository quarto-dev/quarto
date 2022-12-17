/*
 * server.ts
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
import tmp from 'tmp';
tmp.setGracefulCleanup();

import express from "express";
import morgan from "morgan";
import cors from "cors";

import jayson from 'jayson'

import { appConfigDir, jaysonServerMethods } from 'core-node';

import { kWriterJsonRpcPath } from 'writer-types';
import { editorServerMethods, editorServicesMethods } from 'editor-server';
import { prefsServerMethods } from './prefs';
import { defaultEditorServerOptions } from 'editor-server/src/server/server';

// constants
const kPayloadLimitMb = 100;

export function createServer(resourcesDir: string, editorResourcesDir: string) {

  const userDictionaryDir = appConfigDir("quarto-writer", "user-dictionary");

  const dictionaryOptions = {
    dictionariesDir: path.join(resourcesDir, "dictionaries"),
    userDictionaryDir
  };

  const writerRpcServer = jayson.Server(jaysonServerMethods({
    ...editorServerMethods(defaultEditorServerOptions(editorResourcesDir, "pandoc", kPayloadLimitMb)),
    ...editorServicesMethods({ dictionary: dictionaryOptions }),
    ...writerServerMethods()
  }));

  const server = express()
    .disable("x-powered-by")
    .use(morgan("dev"))
    .use(express.urlencoded({ limit: kPayloadLimitMb+ 'mb', extended: true }))
    .use(express.json({limit: kPayloadLimitMb + 'mb' }))
    .use(cors())
    .use(`${kWriterJsonRpcPath}/*`, writerRpcServer.middleware());

  return server;
}

function writerServerMethods() {
  return prefsServerMethods();
}