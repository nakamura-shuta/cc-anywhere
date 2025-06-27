import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Environment configuration schema
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000").transform(Number),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  CLAUDE_API_KEY: z.string(),
  API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  TASK_TIMEOUT_MS: z.string().default("300000").transform(Number),
  MAX_CONCURRENT_TASKS: z.string().default("10").transform(Number),
  USE_CLAUDE_CODE_SDK: z
    .string()
    .default("true")
    .transform(() => true), // Always use Claude Code SDK
  QUEUE_CONCURRENCY: z.string().default("2").transform(Number),
  DB_PATH: z.string().default("./data/cc-anywhere.db"),
  WORKER_MODE: z.enum(["inline", "standalone", "managed"]).default("inline"),
  WORKER_COUNT: z.string().default("1").transform(Number),
  WEBSOCKET_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  WEBSOCKET_HEARTBEAT_INTERVAL: z.string().default("30000").transform(Number),
  WEBSOCKET_HEARTBEAT_TIMEOUT: z.string().default("60000").transform(Number),
  WEBSOCKET_AUTH_TIMEOUT: z.string().default("10000").transform(Number),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  server: {
    port: env.PORT,
    host: env.HOST,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  claude: {
    apiKey: env.CLAUDE_API_KEY,
  },
  auth: {
    apiKey: env.API_KEY,
    enabled: !!env.API_KEY,
  },
  cors: {
    origin: env.CORS_ORIGIN?.split(",") || true,
  },
  tasks: {
    defaultTimeout: env.TASK_TIMEOUT_MS,
    maxConcurrent: env.MAX_CONCURRENT_TASKS,
    useClaudeCodeSDK: env.USE_CLAUDE_CODE_SDK,
  },
  queue: {
    concurrency: env.QUEUE_CONCURRENCY,
  },
  database: {
    path: env.DB_PATH,
  },
  worker: {
    mode: env.WORKER_MODE,
    count: env.WORKER_COUNT,
  },
  websocket: {
    enabled: env.WEBSOCKET_ENABLED,
    heartbeatInterval: env.WEBSOCKET_HEARTBEAT_INTERVAL,
    heartbeatTimeout: env.WEBSOCKET_HEARTBEAT_TIMEOUT,
    authTimeout: env.WEBSOCKET_AUTH_TIMEOUT,
  },
} as const;
