/*
 * pandoc.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import stream from 'node:stream';
import * as child_process from "node:child_process";


export interface PandocServerOptions {
  pandocPath: string;
  resourcesDir: string;
  payloadLimitMb: number;
}

export async function runPandoc(pandoc: PandocServerOptions, args: readonly string[] | null, stdin?: string) : Promise<string> {
  return new Promise((resolve, reject) => {
    const child = child_process.execFile(pandoc.pandocPath, args, { 
      encoding: "utf-8", 
      maxBuffer: pandoc.payloadLimitMb * 1024 * 1024 }, 
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else if (child.exitCode !== 0) {
          reject(new Error(`Error status ${child.exitCode}: ${stderr.trim()}`));
        } else {
          resolve(stdout.trim());
        }
    });  
    if (stdin) {
      const stdinStream = new stream.Readable();
      stdinStream.push(stdin);  
      stdinStream.push(null);  
      if (child.stdin) {
        child.stdin.on('error', () => {
          // allow errors to be reported by main handler
        });
        stdinStream.pipe(child.stdin);
      } else {
        reject(new Error("Unable to access Pandoc stdin stream"));
      }
    }
  });
}




