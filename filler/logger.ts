import chalk from "chalk";
import { pino, type Level, type Logger } from "pino";
import pretty, { type PrettyOptions } from "pino-pretty";
import uniqolor from "uniqolor";

const prettyConfig: PrettyOptions = {
  ignore: "hostname,pid,level",
  messageFormat: (log, msgKey) => {
    const message = `${log[msgKey]}`;

    if (log.name) {
      return chalk.hex(uniqolor(log.name as string).color)(message);
    }

    return message;
  },
};

function createLogger(name?: string, logLevel?: Level) {
  logLevel = logLevel || "info";
  const baseConfig = { level: logLevel, name };

  return pino(baseConfig, pretty(prettyConfig));
}

const log = createLogger();

export { createLogger, log, type Level, type Logger };
