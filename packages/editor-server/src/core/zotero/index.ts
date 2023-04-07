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

// TODO: console log messages occurr in front end during sync
// (perhaps we should have those logs be done in 'progress')

// TODO: when we finish a complete from zotero we get a sync

// TODO: detect auth error in front end and wipe key
// (and prompt to re-auth)

// TODO: configuration for multiple libraries

// TODO: respect the client cache (transmit)

export * from './web';
