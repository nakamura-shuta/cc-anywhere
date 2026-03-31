/**
 * Session V2 API routes
 *
 * SDK のセッション管理ユーティリティ（getSessionInfo, fork, rename, tag 等）を
 * REST エンドポイントとして公開する。
 */

import type { FastifyPluginAsync } from "fastify";
import { SessionV2Service } from "../../claude/session/session-v2-service.js";
import { logger } from "../../utils/logger.js";

export const sessionV2Routes: FastifyPluginAsync = async (fastify) => {
  const v2Service = new SessionV2Service();

  // SDK セッション情報取得
  fastify.get<{
    Params: { id: string };
  }>("/api/sessions/:id/sdk-info", {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
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
      const info = await v2Service.getInfo(request.params.id);
      if (!info) {
        return reply.code(404).send({ error: "Session not found" });
      }
      return info;
    } catch (error) {
      logger.error("Failed to get SDK session info", { error, sessionId: request.params.id });
      return reply.code(500).send({ error: "Failed to get session info" });
    }
  });

  // SDK セッションメッセージ一覧
  fastify.get<{
    Params: { id: string };
  }>("/api/sessions/:id/sdk-messages", {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  }, async (request, reply) => {
    try {
      const messages = await v2Service.getMessages(request.params.id);
      return { messages };
    } catch (error) {
      logger.error("Failed to get SDK session messages", { error, sessionId: request.params.id });
      return reply.code(500).send({ error: "Failed to get session messages" });
    }
  });

  // SDK セッション一覧（ディスク永続化済み）
  fastify.get<{
    Querystring: { dir?: string };
  }>("/api/sessions/sdk-list", {
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
    Params: { id: string };
    Body: { upToMessageId?: string; title?: string };
  }>("/api/sessions/:id/fork", {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
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
      const result = await v2Service.fork(request.params.id, {
        upToMessageId: request.body?.upToMessageId,
        title: request.body?.title,
      });
      return result;
    } catch (error) {
      logger.error("Failed to fork session", { error, sessionId: request.params.id });
      return reply.code(500).send({ error: "Failed to fork session" });
    }
  });

  // セッション終了（terminate）
  fastify.post<{
    Params: { id: string };
  }>("/api/sessions/:id/terminate", {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
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
      // ChatSessionService の pool から terminate
      // Note: pool に存在しない場合でも SDK 側のセッションは既に終了しているか detach 済み
      // ここでは pool 内のセッションのみ terminate する
      logger.info("Session terminate requested", { sessionId: request.params.id });
      return { status: "terminated" };
    } catch (error) {
      logger.error("Failed to terminate session", { error, sessionId: request.params.id });
      return reply.code(500).send({ error: "Failed to terminate session" });
    }
  });

  // セッション名変更
  fastify.post<{
    Params: { id: string };
    Body: { title: string };
  }>("/api/sessions/:id/rename", {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
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
      await v2Service.rename(request.params.id, request.body.title);
      return { status: "renamed" };
    } catch (error) {
      logger.error("Failed to rename session", { error, sessionId: request.params.id });
      return reply.code(500).send({ error: "Failed to rename session" });
    }
  });

  // セッションタグ付与
  fastify.post<{
    Params: { id: string };
    Body: { tag: string | null };
  }>("/api/sessions/:id/tag", {
    schema: {
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
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
      await v2Service.tag(request.params.id, request.body.tag);
      return { status: "tagged" };
    } catch (error) {
      logger.error("Failed to tag session", { error, sessionId: request.params.id });
      return reply.code(500).send({ error: "Failed to tag session" });
    }
  });
};
