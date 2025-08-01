import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

// 認証不要なパス
const PUBLIC_PATHS = ["/health", "/api/auth/verify", "/api/auth/status"];

// パスが認証不要かチェック
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
}

// トークンを取得
export function extractToken(request: FastifyRequest): string | undefined {
  // ヘッダーから取得
  const headerToken = request.headers["x-auth-token"] as string;
  if (headerToken) return headerToken;

  // クエリパラメータから取得
  const queryToken = (request.query as any)?.auth_token;
  if (queryToken) return queryToken;

  return undefined;
}

export const qrAuthMiddleware: FastifyPluginAsync = async (fastify) => {
  // 認証検証エンドポイント (グローバルに登録)
  fastify.get("/api/auth/verify", async (request, reply) => {
    if (!config.qrAuth.enabled) {
      return reply.send({ valid: true, message: "QR auth is disabled" });
    }

    const token = extractToken(request);
    const valid = token === config.qrAuth.token;

    return reply.send({
      valid,
      message: valid ? "Authentication successful" : "Invalid token",
    });
  });

  // 認証状態確認エンドポイント
  fastify.get("/api/auth/status", async (_request, reply) => {
    return reply.send({
      enabled: config.qrAuth.enabled,
      requiresAuth: config.qrAuth.enabled && !!config.qrAuth.token,
    });
  });

  // 認証チェックフック
  fastify.addHook("onRequest", async (request, reply) => {
    // QR認証が無効な場合はスキップ
    if (!config.qrAuth.enabled || !config.qrAuth.token) {
      return;
    }

    // 認証不要なパスはスキップ
    if (isPublicPath(request.url)) {
      return;
    }

    // APIルート以外（静的ファイル、SPAルート、WebSocket）はスキップ
    if (!request.url.startsWith("/api/") || request.headers.upgrade === "websocket") {
      return;
    }

    // トークン検証
    const token = extractToken(request);

    if (token !== config.qrAuth.token) {
      logger.warn("Unauthorized access attempt", {
        path: request.url,
        method: request.method,
        ip: request.ip,
        hasToken: !!token,
      });

      return reply.status(401).send({
        error: {
          message: "Unauthorized: Invalid or missing authentication token",
          statusCode: 401,
          code: "UNAUTHORIZED",
        },
      });
    }
  });

  logger.info("QR authentication middleware initialized", {
    enabled: config.qrAuth?.enabled ?? false,
    hasToken: !!config.qrAuth?.token,
  });
};
