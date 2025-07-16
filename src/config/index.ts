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
  TASK_TIMEOUT_MS: z.string().default("600000").transform(Number), // 10 minutes
  MAX_CONCURRENT_TASKS: z.string().default("10").transform(Number),
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
  // Tunnel configuration
  TUNNEL_TYPE: z.enum(["none", "ngrok", "cloudflare"]).default("none"),
  ENABLE_NGROK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  CLOUDFLARE_TUNNEL_TOKEN: z.string().optional(),
  CLOUDFLARE_TUNNEL_NAME: z.string().default("cc-anywhere"),
  SHOW_QR_CODE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  // Worktree設定
  ENABLE_WORKTREE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  WORKTREE_BASE_PATH: z.string().default(".worktrees"),
  MAX_WORKTREES: z.string().default("5").transform(Number),
  WORKTREE_AUTO_CLEANUP: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  WORKTREE_CLEANUP_DELAY: z.string().default("300000").transform(Number), // 5分
  WORKTREE_PREFIX: z.string().default("cc-anywhere"),
  WORKTREE_DEFAULT_BASE_BRANCH: z.string().optional(), // デフォルトは現在のブランチを使用
  // Claude Code SDK設定
  DEFAULT_MAX_TURNS: z.string().default("50").transform(Number), // 最大値の50に設定
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
  tunnel: {
    type: env.TUNNEL_TYPE,
    enabled: env.TUNNEL_TYPE !== "none" || env.ENABLE_NGROK, // 後方互換性
    showQRCode: env.SHOW_QR_CODE,
  },
  ngrok: {
    enabled: env.ENABLE_NGROK || env.TUNNEL_TYPE === "ngrok",
  },
  cloudflare: {
    enabled: env.TUNNEL_TYPE === "cloudflare",
    token: env.CLOUDFLARE_TUNNEL_TOKEN,
    name: env.CLOUDFLARE_TUNNEL_NAME,
  },
  worktree: {
    enabled: env.ENABLE_WORKTREE,
    basePath: env.WORKTREE_BASE_PATH,
    maxWorktrees: env.MAX_WORKTREES,
    autoCleanup: env.WORKTREE_AUTO_CLEANUP,
    cleanupDelay: env.WORKTREE_CLEANUP_DELAY,
    prefix: env.WORKTREE_PREFIX,
    defaultBaseBranch: env.WORKTREE_DEFAULT_BASE_BRANCH,
  },
  claudeCodeSDK: {
    defaultMaxTurns: env.DEFAULT_MAX_TURNS,
  },
} as const;
