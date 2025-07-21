import type { FastifyPluginAsync } from "fastify";
import { SessionManager } from "../../services/session-manager";
import { TaskExecutorImpl } from "../../claude/executor";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  ContinueSessionRequest,
  ContinueSessionResponse,
  GetSessionHistoryResponse,
  ListSessionsResponse,
} from "../../types/session";
import type { TaskRequest } from "../../claude/types";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  const sessionManager = new SessionManager();
  const taskExecutor = new TaskExecutorImpl();

  // セッション作成
  fastify.post<{
    Body: CreateSessionRequest;
    Reply: CreateSessionResponse;
  }>("/api/sessions", async (request, reply) => {
    try {
      const session = await sessionManager.createSession(request.body);
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
  fastify.get<{
    Params: { id: string };
  }>("/api/sessions/:id", async (request, reply) => {
    try {
      const session = await sessionManager.getSession(request.params.id);
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

  // セッション継続
  fastify.post<{
    Params: { id: string };
    Body: ContinueSessionRequest;
    Reply: ContinueSessionResponse;
  }>("/api/sessions/:id/continue", async (request, reply) => {
    try {
      const sessionId = request.params.id;

      // セッションの存在確認
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: "Session not found" } as any);
      }

      // セッションがアクティブか確認
      if (session.status !== "active") {
        return reply.code(400).send({ error: "Session is not active" } as any);
      }

      // 次のターン番号を取得
      const turnNumber = await sessionManager.getNextTurnNumber(sessionId);

      // タスクIDを生成
      const taskId = uuidv4();

      // タスクリクエストを構築
      const taskRequest: TaskRequest = {
        instruction: request.body.instruction,
        context: session.context as any,
        options: {
          ...request.body.options,
          sdk: {
            ...(request.body.options as any)?.sdk,
            // セッションを再開する場合は resumeSession のみを使用
            resumeSession: sessionId,
          },
        },
      };

      // タスクを実行
      const result = await taskExecutor.execute(taskRequest, taskId);

      // 会話ターンを保存
      await sessionManager.addConversationTurn({
        sessionId,
        turnNumber,
        instruction: request.body.instruction,
        response:
          typeof result.output === "string"
            ? result.output
            : JSON.stringify(result.output || result),
        metadata: {
          taskId,
          duration: result.duration,
          toolsUsed: result.toolsUsed,
          filesModified: result.filesModified,
          error: result.error,
        },
      });

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
  fastify.delete<{
    Params: { id: string };
  }>("/api/sessions/:id", async (request, reply) => {
    try {
      await sessionManager.deleteSession(request.params.id);
      return reply.code(204).send();
    } catch (error) {
      logger.error("Failed to delete session", { error });
      return reply.code(500).send({
        error: "Failed to delete session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // 会話履歴取得
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
    Reply: GetSessionHistoryResponse;
  }>("/api/sessions/:id/history", async (request, reply) => {
    try {
      const sessionId = request.params.id;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

      const turns = await sessionManager.getConversationHistory(sessionId, limit, offset);
      const allTurns = await sessionManager.getConversationHistory(sessionId);
      const totalTurns = allTurns.length;

      return {
        sessionId,
        turns,
        totalTurns,
        hasMore: offset + limit < totalTurns,
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
    Querystring: {
      status?: string;
      userId?: string;
      limit?: string;
      offset?: string;
    };
    Reply: ListSessionsResponse;
  }>("/api/sessions", async (request, reply) => {
    try {
      // statusがactiveの場合のみ、getActiveSessionsを使用
      if (request.query.status === "active") {
        const sessions = await sessionManager.getActiveSessions(request.query.userId);
        return {
          sessions,
          total: sessions.length,
          hasMore: false,
        };
      }

      // その他のステータスの場合は、今後実装予定
      // TODO: getAllSessionsメソッドを実装
      return {
        sessions: [],
        total: 0,
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
