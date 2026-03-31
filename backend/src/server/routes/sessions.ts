/**
 * Session routes - unified session management (Task + Chat)
 */

import type { FastifyPluginAsync } from "fastify";
import { TaskExecutorImpl } from "../../claude/executor";
import type { TaskRequest } from "../../claude/types";
import type { UnifiedSessionService } from "../../session/unified-session-service.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";

export const sessionRoutes: FastifyPluginAsync<{
  sessionService: UnifiedSessionService;
}> = async (fastify, opts) => {
  const { sessionService } = opts;
  const taskExecutor = new TaskExecutorImpl();

  // セッション作成
  fastify.post("/api/sessions", async (request, reply) => {
    try {
      const body = request.body as any;
      const session = sessionService.sessions.create({
        type: body.type || "task",
        userId: body.userId,
        workingDirectory: body.context?.workingDirectory,
        context: body.context,
        metadata: body.metadata,
        expiresIn: body.expiresIn,
      });
      return reply.code(201).send({ session });
    } catch (error) {
      logger.error("Failed to create session", { error });
      return reply.code(500).send({
        error: "Failed to create session",
        message: error instanceof Error ? error.message : "Unknown error",
      } as any);
    }
  });

  // セッション取得
  fastify.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    try {
      const session = sessionService.sessions.get(request.params.id);
      if (!session) {
        return reply.code(404).send({ error: "Session not found" } as any);
      }
      return session;
    } catch (error) {
      logger.error("Failed to get session", { error });
      return reply.code(500).send({
        error: "Failed to get session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // セッション継続（Task 用）
  fastify.post<{
    Params: { id: string };
    Body: { instruction: string; options?: any };
  }>("/api/sessions/:id/continue", async (request, reply) => {
    try {
      const sessionId = request.params.id;

      const session = sessionService.sessions.get(sessionId);
      if (!session) {
        return reply.code(404).send({ error: "Session not found" } as any);
      }
      if (session.status !== "active") {
        return reply.code(400).send({ error: "Session is not active" } as any);
      }

      const turnNumber = sessionService.messages.getNextTurnNumber(sessionId);
      const taskId = uuidv4();

      // Use sdkSessionId from DB for resume (if available)
      const resumeId = session.sdkSessionId || sessionId;

      const taskRequest: TaskRequest = {
        instruction: request.body.instruction,
        context: session.context as any,
        options: {
          ...request.body.options,
          sdk: {
            ...(request.body.options as any)?.sdk,
            resumeSession: resumeId,
          },
        },
      };

      const result = await taskExecutor.execute(taskRequest, taskId);

      // Save user message
      sessionService.messages.add({
        sessionId,
        role: "user",
        content: request.body.instruction,
        turnNumber,
        metadata: { taskId },
      });

      // Save agent response
      const responseText = typeof result.output === "string"
        ? result.output
        : JSON.stringify(result.output || result);

      sessionService.messages.add({
        sessionId,
        role: "agent",
        content: responseText,
        turnNumber,
        metadata: {
          taskId,
          duration: result.duration,
          toolsUsed: result.toolsUsed,
          filesModified: result.filesModified,
          error: result.error,
        },
      });

      // Save sdkSessionId if returned
      if (result.sdkSessionId) {
        sessionService.sessions.updateSdkSessionId(sessionId, result.sdkSessionId);
      }

      return {
        turnNumber,
        taskId,
        result: result.output || result,
        error: result.error,
      };
    } catch (error) {
      logger.error("Failed to continue session", { error });
      return reply.code(500).send({
        error: "Failed to continue session",
        message: error instanceof Error ? error.message : "Unknown error",
      } as any);
    }
  });

  // セッション削除
  fastify.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    try {
      sessionService.sessions.delete(request.params.id);
      return reply.code(204).send();
    } catch (error) {
      logger.error("Failed to delete session", { error });
      return reply.code(500).send({
        error: "Failed to delete session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // メッセージ履歴取得（Task + Chat 共通）
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>("/api/sessions/:id/history", async (request, reply) => {
    try {
      const sessionId = request.params.id;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

      const messages = sessionService.messages.list(sessionId, limit, offset);
      const allMessages = sessionService.messages.list(sessionId);

      return {
        sessionId,
        messages,
        totalMessages: allMessages.length,
        hasMore: offset + limit < allMessages.length,
      };
    } catch (error) {
      logger.error("Failed to get session history", { error });
      return reply.code(500).send({
        error: "Failed to get session history",
        message: error instanceof Error ? error.message : "Unknown error",
      } as any);
    }
  });

  // セッション一覧取得
  fastify.get<{
    Querystring: { type?: string; status?: string; userId?: string };
  }>("/api/sessions", async (request, reply) => {
    try {
      const sessions = sessionService.sessions.list({
        type: request.query.type,
        userId: request.query.userId,
        status: request.query.status || "active",
      });
      return {
        sessions,
        total: sessions.length,
        hasMore: false,
      };
    } catch (error) {
      logger.error("Failed to list sessions", { error });
      return reply.code(500).send({
        error: "Failed to list sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      } as any);
    }
  });
};
