import { EventEmitter, LogLevel, LogOutputChannel } from "vscode";

/**
 * A {@link LogOutputChannel} that logs to the console.
 * Set `QUIET=1` to suppress all output.
 */
export class TestLogOutputChannel implements LogOutputChannel {
  logLevel: LogLevel = process.env.QUIET ? LogLevel.Off : LogLevel.Trace;
  onDidChangeLogLevel = new EventEmitter<LogLevel>().event;

  constructor(public readonly name = "") { }

  append(value: string) {
    if (this.logLevel !== LogLevel.Off) {
      console.log(this.name ? `[${this.name}] ${value}` : value);
    }
  }
  appendLine(value: string) { this.append(value); }
  clear() { }
  show() { }
  hide() { }
  dispose() { }
  replace(_value: any) { }
  trace(value: string) { if (this.logLevel <= LogLevel.Trace) { this.append(value); } }
  debug(value: string) { if (this.logLevel <= LogLevel.Debug) { this.append(value); } }
  info(value: string) { if (this.logLevel <= LogLevel.Info) { this.append(value); } }
  warn(value: string) { if (this.logLevel <= LogLevel.Warning) { this.append(value); } }
  error(value: string) { if (this.logLevel <= LogLevel.Error) { this.append(value); } }
}
