import winston from "winston";
import { config } from "../config";
import fs from "fs";
import path from "path";

const logDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, config.isDevelopment ? "backend-dev.log" : "backend.log");

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
    new winston.transports.File({
      filename: logFile,
      level: config.logging.level,
      maxsize: 10 * 1024 * 1024, // 10MB でローテーション
      maxFiles: 5,
    }),
  ],
});

if (!config.isProduction) {
  logger.debug("Logger initialized in development mode");
}
