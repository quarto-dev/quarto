/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";

import * as yaml from "js-yaml";
import { ExecFileSyncOptions } from "child_process";

export function parseFrontMatterStr(str: string) {
  str = str.replace(/---\s*$/, "");
  try {
    return yaml.load(str);
  } catch (error) {
    return undefined;
  }
}

export function projectDirForDocument(doc: string) {
  let dir = path.dirname(doc);
  while (true) {
    if (hasQuartoProject(dir)) {
      return dir;
    } else {
      const nextDir = path.dirname(dir);
      if (nextDir !== dir) {
        dir = nextDir;
      } else {
        break;
      }
    }
  }
  return undefined;
}

export function metadataFilesForDocument(doc: string) {
  const files: string[] = [];

  let dir = path.dirname(doc);
  while (true) {
    if (hasQuartoProject(dir)) {
      files.push(
        ...["_quarto.yml", "_quarto.yaml"]
          .map((file) => path.join(dir, file))
          .filter(fs.existsSync)
      );
      return files;
    } else {
      files.push(
        ...["_metadata.yml", "_metadata.yaml"]
          .map((file) => path.join(dir, file))
          .filter(fs.existsSync)
      );
      const nextDir = path.dirname(dir);
      if (nextDir !== dir) {
        dir = nextDir;
      } else {
        break;
      }
    }
  }
  return undefined;
}

export function hasQuartoProject(dir?: string) {
  if (dir) {
    return (
      fs.existsSync(path.join(dir, "_quarto.yml")) ||
      fs.existsSync(path.join(dir, "_quarto.yaml"))
    );
  } else {
    return false;
  }
}

export function yamlFromMetadataFile(file: string): Record<string, unknown> {
  const yamlSrc = fs.readFileSync(file, "utf-8");
  try {
    if (yamlSrc.trim().length > 0) {
      const yamlOpts = yaml.load(yamlSrc) as Record<string, unknown>;
      return yamlOpts;
    }
  } catch (err) {
    console.error(err);
  }
  return {};
}

export type QuartoProjectConfig = {
  dir: string;
  config: {
    project: {
      type: string;
      preview: {
        serve: {};
      };
    };
  };
  files: {
    config: string[];
  };
};

export async function quartoProjectConfig(
  runQuarto: (options: ExecFileSyncOptions, ...args: string[]) => string,
  file: string
): Promise<QuartoProjectConfig | undefined> {
  // disqualifying conditions
  if (!fs.existsSync(file)) {
    return undefined;
  }
  // lookup in cache
  if (configCache.has(file)) {
    // get the value
    const cache = configCache.get(file);

    // if its undefined that means there is no project config
    if (cache === undefined) {
      return undefined;
      // otherwise check the hash (i.e. has the project file or the config
      // files it includes changed)
    } else if (cache.hash === configHash(cache.config)) {
      return cache.config;
    }
  }

  // try to find the config
  let config: QuartoProjectConfig | undefined;

  try {
    if (fs.statSync(file).isDirectory()) {
      config = JSON.parse(
        runQuarto({ cwd: file }, "inspect")
      ) as QuartoProjectConfig;
      // older versions of quarto don't provide the dir so fill it in if we need to
      if (!config.dir) {
        config.dir = file;
      }
    } else {
      config = JSON.parse(
        runQuarto({ cwd: path.dirname(file) }, "inspect", path.basename(file))
      ).project as QuartoProjectConfig | undefined;
      // older versions of quarto don't provide the dir so fill it in if we need to
      if (config && !config.dir) {
        const projectDir = projectDirForDocument(file);
        if (projectDir) {
          config.dir = projectDir;
        } else {
          // can't determine the project dir so we are going to say no project
          config = undefined;
        }
      }
    }
  } catch (e) {
    config = undefined;
  }

  // now store the config in the cache
  configCache.set(
    file,
    config ? { hash: configHash(config), config } : undefined
  );

  // return it
  return config;
}

// cache previously read configs (undefined means no project)
const configCache = new Map<
  string,
  { hash: string; config: QuartoProjectConfig } | undefined
>();

// include modification times of referenced config files in cache key
function configHash(config: QuartoProjectConfig) {
  return config.files.config.reduce((hash, file) => {
    return hash + fs.statSync(file).mtimeMs.toLocaleString();
  }, "");
}
