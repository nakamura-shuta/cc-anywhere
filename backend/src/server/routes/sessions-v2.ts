/**
 * Session V2 API routes
 *
 * SDK セッション管理ユーティリティを REST エンドポイントとして公開する。
 * パスは /api/sdk-sessions/ で、パラメータ :sdkSessionId は SDK session ID を直接取る。
 * （既存の /api/sessions/:id はアプリ内部 session ID を使う別パス）
 */

import type { FastifyPluginAsync } from "fastify";
import { SessionV2Service } from "../../claude/session/session-v2-service.js";
import type { ChatSessionService } from "../../claude/session/chat-session-service.js";
import { logger } from "../../utils/logger.js";

export const sessionV2Routes: FastifyPluginAsync<{
  chatSessionService: ChatSessionService;
}> = async (fastify, opts) => {
  const v2Service = new SessionV2Service();
  const chatSessionService = opts.chatSessionService;

  // SDK セッション情報取得
  fastify.get<{
    Params: { sdkSessionId: string };
  }>("/api/sdk-sessions/:sdkSessionId/info", {
    schema: {
      params: {
        type: "object",
        properties: { sdkSessionId: { type: "string" } },
        required: ["sdkSessionId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            summary: { type: "string" },
            lastModified: { type: "number" },
            customTitle: { type: "string", nullable: true },
            firstPrompt: { type: "string", nullable: true },
            gitBranch: { type: "string", nullable: true },
            cwd: { type: "string", nullable: true },
            tag: { type: "string", nullable: true },
            createdAt: { type: "number", nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const info = await v2Service.getInfo(request.params.sdkSessionId);
      if (!info) {
        return reply.code(404).send({ error: "SDK session not found" });
      }
      return info;
    } catch (error) {
      logger.error("Failed to get SDK session info", { error, sdkSessionId: request.params.sdkSessionId });
      return reply.code(500).send({ error: "Failed to get session info" });
    }
  });

  // SDK セッションメッセージ一覧
  fastify.get<{
    Params: { sdkSessionId: string };
  }>("/api/sdk-sessions/:sdkSessionId/messages", {
    schema: {
      params: {
        type: "object",
        properties: { sdkSessionId: { type: "string" } },
        required: ["sdkSessionId"],
      },
    },
  }, async (request, reply) => {
    try {
      const messages = await v2Service.getMessages(request.params.sdkSessionId);
      return { messages };
    } catch (error) {
      logger.error("Failed to get SDK session messages", { error, sdkSessionId: request.params.sdkSessionId });
      return reply.code(500).send({ error: "Failed to get session messages" });
    }
  });

  // SDK セッション一覧（ディスク永続化済み）
  fastify.get<{
    Querystring: { dir?: string };
  }>("/api/sdk-sessions", {
    schema: {
      querystring: {
        type: "object",
        properties: { dir: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    try {
      const sessions = await v2Service.list(
        request.query.dir ? { dir: request.query.dir } : undefined,
      );
      return { sessions };
    } catch (error) {
      logger.error("Failed to list SDK sessions", { error });
      return reply.code(500).send({ error: "Failed to list sessions" });
    }
  });

  // セッションフォーク
  fastify.post<{
    Params: { sdkSessionId: string };
    Body: { upToMessageId?: string; title?: string };
  }>("/api/sdk-sessions/:sdkSessionId/fork", {
    schema: {
      params: {
        type: "object",
        properties: { sdkSessionId: { type: "string" } },
        required: ["sdkSessionId"],
      },
      body: {
        type: "object",
        properties: {
          upToMessageId: { type: "string" },
          title: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: { sdkSessionId: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const result = await v2Service.fork(request.params.sdkSessionId, {
        upToMessageId: request.body?.upToMessageId,
        title: request.body?.title,
      });
      return result;
    } catch (error) {
      logger.error("Failed to fork session", { error, sdkSessionId: request.params.sdkSessionId });
      return reply.code(500).send({ error: "Failed to fork session" });
    }
  });

  // セッション終了（terminate）
  // Note: active pool に存在するセッションのみ terminate 可能。
  // detach 済み（WS 切断後）のセッションは pool 管理外のため 404 を返す。
  // detach 済みセッションの終了が必要な場合は、再接続後に terminate するか、
  // TTL eviction による自動終了を待つ。
  fastify.post<{
    Params: { sdkSessionId: string };
  }>("/api/sdk-sessions/:sdkSessionId/terminate", {
    schema: {
      params: {
        type: "object",
        properties: { sdkSessionId: { type: "string" } },
        required: ["sdkSessionId"],
      },
      response: {
        200: {
          type: "object",
          properties: { status: { type: "string" } },
        },
        404: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { sdkSessionId } = request.params;
      const terminated = chatSessionService.terminateById(sdkSessionId);
      if (!terminated) {
        return reply.code(404).send({
          error: "Session not in active pool. It may have been detached (WS disconnected) or was never managed by this server.",
        });
      }
      logger.info("Session terminated via API", { sdkSessionId });
      return { status: "terminated" };
    } catch (error) {
      logger.error("Failed to terminate session", { error, sdkSessionId: request.params.sdkSessionId });
      return reply.code(500).send({ error: "Failed to terminate session" });
    }
  });

  // セッション名変更
  fastify.post<{
    Params: { sdkSessionId: string };
    Body: { title: string };
  }>("/api/sdk-sessions/:sdkSessionId/rename", {
    schema: {
      params: {
        type: "object",
        properties: { sdkSessionId: { type: "string" } },
        required: ["sdkSessionId"],
      },
      body: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
      response: {
        200: {
          type: "object",
          properties: { status: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      await v2Service.rename(request.params.sdkSessionId, request.body.title);
      return { status: "renamed" };
    } catch (error) {
      logger.error("Failed to rename session", { error, sdkSessionId: request.params.sdkSessionId });
      return reply.code(500).send({ error: "Failed to rename session" });
    }
  });

  // セッションタグ付与
  fastify.post<{
    Params: { sdkSessionId: string };
    Body: { tag: string | null };
  }>("/api/sdk-sessions/:sdkSessionId/tag", {
    schema: {
      params: {
        type: "object",
        properties: { sdkSessionId: { type: "string" } },
        required: ["sdkSessionId"],
      },
      body: {
        type: "object",
        properties: { tag: { type: ["string", "null"] } },
        required: ["tag"],
      },
      response: {
        200: {
          type: "object",
          properties: { status: { type: "string" } },
        },
      },
    },
  }, async (request, reply) => {
    try {
      await v2Service.tag(request.params.sdkSessionId, request.body.tag);
      return { status: "tagged" };
    } catch (error) {
      logger.error("Failed to tag session", { error, sdkSessionId: request.params.sdkSessionId });
      return reply.code(500).send({ error: "Failed to tag session" });
    }
  });
};
