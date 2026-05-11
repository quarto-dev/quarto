import { EventEmitter, LogLevel, LogOutputChannel } from "vscode";

/** A {@link LogOutputChannel} that logs to the console. */
export class TestLogOutputChannel implements LogOutputChannel {
  logLevel = LogLevel.Trace;
  onDidChangeLogLevel = new EventEmitter<LogLevel>().event;
  constructor(public readonly name = "") { }
  append(value: string) { console.log(this.name ? `[${this.name}] ${value}` : value); }
  appendLine(value: string) { this.append(value); }
  clear() { }
  show() { }
  hide() { }
  dispose() { }
  replace(_value: any) { }
  trace(value: string) { this.append(value); }
  debug(value: string) { this.append(value); }
  info(value: string) { this.append(value); }
  warn(value: string) { this.append(value); }
  error(value: string) { this.append(value); }
}
