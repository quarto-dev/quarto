import { OutputChannel } from "vscode";

/** An {@link OutputChannel} that logs to the console. */
export class TestOutputChannel implements OutputChannel {
  constructor(public readonly name: string) { }
  append(value: string) { console.log(`[${this.name}] ${value}`); }
  appendLine(value: string) { this.append(value); }
  clear() { }
  show() { }
  hide() { }
  dispose() { }
  replace(_value: string) { }
}
