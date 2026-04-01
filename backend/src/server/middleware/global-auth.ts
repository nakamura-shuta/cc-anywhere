import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// 認証不要なパス
const PUBLIC_PATHS = [
  "/health",
  "/api/auth/verify",
  "/api/auth/status",
  "/api/auth/register",
  "/api/auth/login",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
}

function extractToken(request: FastifyRequest): string | undefined {
  const headerToken = request.headers["x-api-key"] as string;
  if (headerToken) return headerToken;

  const query = request.query as Record<string, string>;
  const queryToken = query?.api_key;
  if (queryToken) return queryToken;

  return undefined;
}

// Shared UserService reference (set by routes.ts)
let userServiceRef: any = null;
export function setUserServiceForAuth(service: any): void {
  userServiceRef = service;
}

export const globalAuthMiddleware: FastifyPluginAsync = async (fastify) => {
  // 認証検証エンドポイント
  fastify.get("/api/auth/verify", async (request, reply) => {
    if (!config.auth.enabled) {
      return reply.send({ valid: true, message: "Auth is disabled" });
    }

    const token = extractToken(request);

    // Check users table first
    if (userServiceRef && token) {
      const user = userServiceRef.getByApiKey(token);
      if (user) {
        return reply.send({ valid: true, message: "Authentication successful", user: { id: user.id, username: user.username } });
      }
    }

    // Fallback to .env API Key
    const valid = token === config.auth.apiKey;
    return reply.send({
      valid,
      message: valid ? "Authentication successful" : "Invalid token",
    });
  });

  // 認証状態確認エンドポイント
  fastify.get("/api/auth/status", async (_request, reply) => {
    return reply.send({
      enabled: config.auth.enabled,
      requiresAuth: config.auth.enabled && !!config.auth.apiKey,
      qrEnabled: config.qrAuth.enabled,
    });
  });

  // 認証チェックフック
  fastify.addHook("onRequest", async (request, reply) => {
    // 認証判定: .env の API_KEY があるか、users テーブルにユーザーがいるか
    const hasEnvKey = !!config.auth.apiKey;
    const hasUsers = userServiceRef ? userServiceRef.count() > 0 : false;

    if (!hasEnvKey && !hasUsers) {
      // 認証無効（管理者キーもユーザーも未設定）
      (request as any).user = { id: "default-user", username: "default" };
      return;
    }

    // 認証不要なパスはスキップ
    if (isPublicPath(request.url)) {
      return;
    }

    // APIルート以外はスキップ
    if (!request.url.startsWith("/api/") || request.headers.upgrade === "websocket") {
      return;
    }

    const token = extractToken(request);

    // 1. Check users table
    if (userServiceRef && token) {
      const user = userServiceRef.getByApiKey(token);
      if (user) {
        (request as any).user = user;
        (request as any).apiKey = token;
        return;
      }
    }

    // 2. Check .env admin API Key
    if (token === config.auth.apiKey) {
      (request as any).user = { id: "admin", username: "admin" };
      (request as any).apiKey = token;
      return;
    }

    // 3. Unauthorized
    logger.warn("Unauthorized access attempt", {
      path: request.url,
      method: request.method,
      ip: request.ip,
    });

    return reply.status(401).send({
      error: {
        message: "Unauthorized: Invalid or missing authentication token",
        statusCode: 401,
        code: "UNAUTHORIZED",
      },
    });
  });

  logger.info("Global authentication middleware initialized", {
    enabled: config.auth?.enabled ?? false,
    hasToken: !!config.auth?.apiKey,
  });
};
