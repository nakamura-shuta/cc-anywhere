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
    logger.debug("QR Auth hook triggered", {
      url: request.url,
      method: request.method,
      enabled: config.qrAuth.enabled,
      hasToken: !!config.qrAuth.token,
      configToken: config.qrAuth.token,
    });

    // QR認証が無効な場合はスキップ
    if (!config.qrAuth.enabled || !config.qrAuth.token) {
      logger.warn("QR Auth skipped: disabled or no token", {
        enabled: config.qrAuth.enabled,
        hasToken: !!config.qrAuth.token,
        token: config.qrAuth.token,
        url: request.url,
      });
      return;
    }

    // 認証不要なパスはスキップ
    if (isPublicPath(request.url)) {
      logger.debug("QR Auth skipped: public path", { url: request.url });
      return;
    }

    // 静的ファイルやWebSocketはスキップ
    if (
      request.url.startsWith("/web/") ||
      request.url === "/" ||
      request.url.includes(".") ||
      request.headers.upgrade === "websocket"
    ) {
      logger.debug("QR Auth skipped: static/websocket", { url: request.url });
      return;
    }

    // トークン検証
    const token = extractToken(request);
    logger.debug("QR Auth: validating token", {
      hasToken: !!token,
      tokenMatches: token === config.qrAuth.token,
      providedToken: token ? token.substring(0, 3) + "..." : "none",
      expectedToken: config.qrAuth.token ? config.qrAuth.token.substring(0, 3) + "..." : "none",
    });

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

    logger.debug("QR Auth: access granted", { url: request.url });
  });

  logger.info("QR authentication middleware initialized", {
    enabled: config.qrAuth?.enabled ?? false,
    hasToken: !!config.qrAuth?.token,
  });
};
