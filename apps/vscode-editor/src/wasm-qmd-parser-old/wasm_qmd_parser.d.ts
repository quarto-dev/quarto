/* tslint:disable */
/* eslint-disable */
export function run(): void;
export function parse_qmd(input: any): any;
export function greet(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly parse_qmd: (a: any) => any;
  readonly run: () => void;
  readonly greet: () => void;
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
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
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
