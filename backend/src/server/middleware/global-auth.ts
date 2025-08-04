import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// 認証不要なパス
const PUBLIC_PATHS = ["/health", "/api/auth/verify", "/api/auth/status"];

// パスが認証不要かチェック
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
}

// トークンを取得
function extractToken(request: FastifyRequest): string | undefined {
  // ヘッダーから取得
  const headerToken = request.headers["x-api-key"] as string;

  if (headerToken) return headerToken;

  // クエリパラメータから取得
  const query = request.query as Record<string, string>;
  const queryToken = query?.api_key;

  if (queryToken) return queryToken;

  return undefined;
}

export const globalAuthMiddleware: FastifyPluginAsync = async (fastify) => {
  // 認証検証エンドポイント
  fastify.get("/api/auth/verify", async (request, reply) => {
    if (!config.auth.enabled) {
      return reply.send({ valid: true, message: "Auth is disabled" });
    }

    const token = extractToken(request);
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
      qrEnabled: config.qrAuth.enabled, // QRコード表示機能の状態
    });
  });

  // 認証チェックフック
  fastify.addHook("onRequest", async (request, reply) => {
    // 認証が無効な場合はスキップ
    if (!config.auth.enabled || !config.auth.apiKey) {
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

    if (token !== config.auth.apiKey) {
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

  logger.info("Global authentication middleware initialized", {
    enabled: config.auth?.enabled ?? false,
    hasToken: !!config.auth?.apiKey,
    qrEnabled: config.qrAuth?.enabled ?? false,
  });
};
