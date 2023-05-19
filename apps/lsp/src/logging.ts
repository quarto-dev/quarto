import { ILogger, LogLevel } from "./service";



function languageServiceLogger() : ILogger {

  const logger : ILogger = {
    level: LogLevel.Off,
    log: function (level: LogLevel, message: string, data?: Record<string, unknown> | undefined): void {
      throw new Error("Function not implemented.");
    }
  };

  return logger;

}
