/*
 * config.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */



export async function safeUpdateConfig(updateFn: () => Promise<void>) {
  try {
    await updateFn();
  } catch (error) {
    // if the user's settings.json file is corrupt/invalid this
    // will throw an exception and prevent loading of the extension
    console.log("Unexpected error writing config (settings.json may be corrupt)");
  }
}
