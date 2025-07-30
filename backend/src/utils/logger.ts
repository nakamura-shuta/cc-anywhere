import winston from "winston";
import { config } from "../config";

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "cc-anywhere" },
  transports: [
    new winston.transports.Console({
      format: config.isDevelopment
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json(),
    }),
  ],
});

if (!config.isProduction) {
  logger.debug("Logger initialized in development mode");
}
