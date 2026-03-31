import dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import fs from "fs";

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(__dirname, "../../../", envFile) });

// Load repository paths from repositories.json
function loadRepositoryPaths(): string[] {
  try {
    const repositoriesPath = path.resolve(__dirname, "../../config/repositories.json");
    if (!fs.existsSync(repositoriesPath)) {
      return [];
    }
    const content = fs.readFileSync(repositoriesPath, "utf-8");
    const data = JSON.parse(content) as { repositories: Array<{ name: string; path: string }> };
    return data.repositories.map((repo) => path.resolve(repo.path));
  } catch (error) {
    // repositories.jsonが存在しないか読み込めない場合は空配列を返す
    return [];
  }
}

// Environment configuration schema
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000").transform(Number),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  CLAUDE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  TASK_TIMEOUT_MS: z.string().default("1800000").transform(Number), // 30 minutes
  MAX_CONCURRENT_TASKS: z.string().default("10").transform(Number),
  QUEUE_CONCURRENCY: z.string().default("2").transform(Number),
  DB_PATH: z.string().default("./data/cc-anywhere.db"),
  WORKER_MODE: z.enum(["inline", "standalone", "managed"]).default("inline"),
  WORKER_COUNT: z.string().default("1").transform(Number),
  WEBSOCKET_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  WEBSOCKET_HEARTBEAT_INTERVAL: z.string().default("60000").transform(Number),
  WEBSOCKET_HEARTBEAT_TIMEOUT: z.string().default("120000").transform(Number),
  WEBSOCKET_AUTH_TIMEOUT: z.string().default("30000").transform(Number),
  WEBSOCKET_MAX_LOG_BUFFER_SIZE: z.string().default("10000").transform(Number),
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
  WORKTREE_PREFIX: z.string().default("cc-anywhere"),
  WORKTREE_DEFAULT_BASE_BRANCH: z.string().optional(), // デフォルトは現在のブランチを使用
  // Claude Code SDK設定
  DEFAULT_MAX_TURNS: z.string().default("50").transform(Number), // デフォルト値（最大）
  // AWS Bedrock設定
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  BEDROCK_MODEL_ID: z.string().default("us.anthropic.claude-opus-4-20250514-v1:0"),
  // 実行モード設定
  FORCE_EXECUTION_MODE: z.enum(["api-key", "bedrock"]).optional(),
  // QR認証設定
  QR_AUTH_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  QR_AUTH_SESSION_DURATION: z.string().default("86400000").transform(Number),
  // Task Queue メモリ管理設定
  TASK_RETENTION_TIME_MS: z.string().default("300000").transform(Number), // 5分
  TASK_CLEANUP_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  // Chat SSE設定
  CHAT_STREAM_TOKEN_SECRET: z.string().default("cc-anywhere-chat-stream-secret-key"),
  CHAT_STREAM_TOKEN_EXPIRY_SECONDS: z.string().default("300").transform(Number),
  // セキュリティ設定
  ALLOWED_WORKING_DIRECTORIES: z
    .string()
    .default("")
    .transform((v) => {
      // 環境変数で指定されたディレクトリ
      const envPaths = v ? v.split(",").map((p) => path.resolve(p.trim())) : [];

      // repositories.jsonから読み込んだディレクトリ
      const repoPaths = loadRepositoryPaths();

      // プロジェクトルート
      const projectRoot = path.resolve(process.cwd());

      // ワークツリーベースパス（compare modeで使用）
      const worktreeBasePath = process.env.WORKTREE_BASE_PATH || ".worktrees";
      const absoluteWorktreeBasePath = path.isAbsolute(worktreeBasePath)
        ? worktreeBasePath
        : path.resolve(process.cwd(), worktreeBasePath);

      // ワークスペースルート
      const workspaceRoot = process.env.WORKSPACE_ROOT
        || path.resolve(process.cwd(), "../workspaces");

      // すべてを結合して重複を削除
      const allPaths = [
        ...new Set([projectRoot, absoluteWorktreeBasePath, workspaceRoot, ...envPaths, ...repoPaths]),
      ];

      return allPaths;
    }),
  STRICT_PATH_VALIDATION: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  REQUIRE_WHITELIST: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Log allowed directories for debugging
if (env.NODE_ENV === "development") {
  console.log("🔐 Allowed working directories:");
  env.ALLOWED_WORKING_DIRECTORIES.forEach((dir) => {
    console.log(`  - ${dir}`);
  });
}

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
  openai: {
    apiKey: env.OPENAI_API_KEY,
  },
  gemini: {
    apiKey: env.GEMINI_API_KEY,
  },
  auth: {
    apiKey: env.API_KEY,
    enabled: !!env.API_KEY,
  },
  chat: {
    streamTokenSecret: env.CHAT_STREAM_TOKEN_SECRET,
    streamTokenExpirySeconds: env.CHAT_STREAM_TOKEN_EXPIRY_SECONDS,
  },
  cors: {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN?.split(",") || true,
  },
  tasks: {
    defaultTimeout: env.TASK_TIMEOUT_MS,
    maxConcurrent: env.MAX_CONCURRENT_TASKS,
  },
  queue: {
    concurrency: env.QUEUE_CONCURRENCY,
    taskRetentionTime: env.TASK_RETENTION_TIME_MS,
    cleanupEnabled: env.TASK_CLEANUP_ENABLED,
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
    maxLogBufferSize: env.WEBSOCKET_MAX_LOG_BUFFER_SIZE,
  },
  tunnel: {
    type: env.TUNNEL_TYPE,
    enabled: env.TUNNEL_TYPE !== "none",
    showQRCode: env.SHOW_QR_CODE,
  },
  ngrok: {
    enabled: env.TUNNEL_TYPE === "ngrok",
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
    prefix: env.WORKTREE_PREFIX,
    defaultBaseBranch: env.WORKTREE_DEFAULT_BASE_BRANCH,
  },
  claudeCodeSDK: {
    defaultMaxTurns: env.DEFAULT_MAX_TURNS,
  },
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
  },
  bedrockModelId: env.BEDROCK_MODEL_ID,
  forceExecutionMode: env.FORCE_EXECUTION_MODE,
  qrAuth: {
    enabled: env.QR_AUTH_ENABLED,
    sessionDuration: env.QR_AUTH_SESSION_DURATION,
  },
  security: {
    allowedWorkingDirectories: env.ALLOWED_WORKING_DIRECTORIES,
    strictPathValidation: env.STRICT_PATH_VALIDATION,
    requireWhitelist: env.REQUIRE_WHITELIST,
  },
} as const;
