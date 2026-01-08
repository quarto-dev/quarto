/*
 * r-utils.ts
 *
 * Copyright (C) 2025 by Posit Software, PBC
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

import * as fs from "fs/promises";
import * as path from "path";
import { URI } from 'vscode-uri';

/**
 * Checks if the given folder contains an R package.
 *
 * Determined by:
 * - Presence of a `DESCRIPTION` file.
 * - Presence of `Package:` field.
 * - Presence of `Type: package` field and value.
 *
 * The fields are checked to disambiguate real packages from book repositories using a `DESCRIPTION` file.
 *
 * @param folderPath Folder to check for a `DESCRIPTION` file.
 */
export async function isRPackage(folderUri: URI): Promise<boolean> {
  // We don't currently support non-file schemes
  if (folderUri.scheme !== 'file') {
    return false;
  }

  const descriptionLines = await parseRPackageDescription(folderUri.fsPath);
  if (!descriptionLines) {
    return false;
  }

  const packageLines = descriptionLines.filter(line => line.startsWith('Package:'));
  const typeLines = descriptionLines.filter(line => line.startsWith('Type:'));

  const typeIsPackage = (typeLines.length > 0
    ? typeLines[0].toLowerCase().includes('package')
    : false);
  const typeIsPackageOrMissing = typeLines.length === 0 || typeIsPackage;

  return packageLines.length > 0 && typeIsPackageOrMissing;
}

async function parseRPackageDescription(folderPath: string): Promise<string[]> {
  const filePath = path.join(folderPath, 'DESCRIPTION');

  try {
    const descriptionText = await fs.readFile(filePath, 'utf8');
    return descriptionText.split(/\r?\n/);
  } catch {
    return [''];
  }
}
