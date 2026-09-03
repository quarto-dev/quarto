/* tslint:disable */
/* eslint-disable */
export function run(): void;
export function parse_qmd(input: any, include_resolved_locations: any): any;
export function write_qmd(input: any): any;
export function convert(document: any, input_format: any, output_format: any): any;
/**
 * Render a QMD document with a template bundle.
 *
 * # Arguments
 * * `input` - QMD source text
 * * `bundle_json` - Template bundle as JSON string
 * * `body_format` - "html" or "plaintext"
 *
 * # Returns
 * JSON object with `{ "output": "..." }` or `{ "error": "...", "diagnostics": [...] }`
 */
export function render_with_template(input: any, bundle_json: any, body_format: any): any;
/**
 * Get a built-in template as a JSON bundle.
 *
 * # Arguments
 * * `name` - Template name ("html5" or "plain")
 *
 * # Returns
 * Template bundle JSON or `{ "error": "..." }`
 */
export function get_builtin_template(name: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly abort: () => void;
  readonly calloc: (a: number, b: number) => number;
  readonly clock: () => bigint;
  readonly fclose: (a: number) => number;
  readonly fdopen: (a: number, b: number) => number;
  readonly fprintf: (a: number, b: number, c: number) => number;
  readonly fputc: (a: number, b: number) => number;
  readonly fputs: (a: number, b: number) => number;
  readonly free: (a: number) => void;
  readonly fwrite: (a: number, b: number, c: number, d: number) => number;
  readonly isprint: (a: number) => number;
  readonly iswalnum: (a: number) => number;
  readonly iswalpha: (a: number) => number;
  readonly iswdigit: (a: number) => number;
  readonly iswspace: (a: number) => number;
  readonly malloc: (a: number) => number;
  readonly memcmp: (a: number, b: number, c: number) => number;
  readonly memcpy: (a: number, b: number, c: number) => number;
  readonly memmove: (a: number, b: number, c: number) => number;
  readonly memset: (a: number, b: number, c: number) => number;
  readonly realloc: (a: number, b: number) => number;
  readonly strncmp: (a: number, b: number, c: number) => number;
  readonly towlower: (a: number) => number;
  readonly vsnprintf: (a: number, b: number, c: number, d: number) => number;
  readonly convert: (a: any, b: any, c: any) => any;
  readonly get_builtin_template: (a: any) => any;
  readonly parse_qmd: (a: any, b: any) => any;
  readonly render_with_template: (a: any, b: any, c: any) => any;
  readonly write_qmd: (a: any) => any;
  readonly run: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
