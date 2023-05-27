// deno run -A run.ts --stdio
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("./lsp.js");

