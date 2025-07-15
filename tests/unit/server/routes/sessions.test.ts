import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sessionRoutes } from "../../../../src/server/routes/sessions";
import type {
  CreateSessionRequest,
  ContinueSessionRequest,
  Session,
  ConversationTurn,
} from "../../../../src/types/session";

// モックセッションマネージャー
const mockSessionManager = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  getConversationHistory: vi.fn(),
  getActiveSessions: vi.fn(),
  addConversationTurn: vi.fn(),
  getNextTurnNumber: vi.fn(),
  expireOldSessions: vi.fn(),
};

// モックタスクエグゼキューター
const mockTaskExecutor = {
  execute: vi.fn(),
};

vi.mock("../../../../src/services/session-manager", () => ({
  SessionManager: vi.fn(() => mockSessionManager),
}));

vi.mock("../../../../src/claude/executor", () => ({
  TaskExecutorImpl: vi.fn(() => mockTaskExecutor),
}));

describe("Session Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    // 認証ミドルウェアをモック
    app.addHook("onRequest", async (request: FastifyRequest, _reply: FastifyReply) => {
      request.apiKey = "test-api-key";
    });

    await app.register(sessionRoutes);
    await app.ready();
  });

  describe("POST /api/sessions", () => {
    it("should create a new session", async () => {
      const request: CreateSessionRequest = {
        metadata: { title: "Test Session" },
        context: { workingDirectory: "/test" },
      };

      const mockSession: Session = {
        id: "session-123",
        status: "active",
        context: request.context,
        metadata: request.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionManager.createSession.mockResolvedValue(mockSession);

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.session.id).toBe("session-123");
      expect(data.session.status).toBe("active");
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(request);
    });

    it("should handle errors during session creation", async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error("Database error"));

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: {},
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Failed to create session");
    });
  });

  describe("GET /api/sessions/:id", () => {
    it("should retrieve an existing session", async () => {
      const mockSession: Session = {
        id: "session-123",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions/session-123",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("session-123");
      expect(mockSessionManager.getSession).toHaveBeenCalledWith("session-123");
    });

    it("should return 404 for non-existent session", async () => {
      mockSessionManager.getSession.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Session not found");
    });
  });

  describe("POST /api/sessions/:id/continue", () => {
    it("should continue an existing session", async () => {
      const sessionId = "session-123";
      const request: ContinueSessionRequest = {
        sessionId,
        instruction: "Continue with this task",
        options: {
          timeout: 60000,
          permissionMode: "bypassPermissions",
        },
      };

      const mockSession: Session = {
        id: sessionId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockHistory: ConversationTurn[] = [
        {
          id: 1,
          sessionId,
          turnNumber: 1,
          instruction: "Previous instruction",
          response: "Previous response",
          createdAt: new Date(),
        },
      ];

      mockSessionManager.getSession.mockResolvedValue(mockSession);
      mockSessionManager.getConversationHistory.mockResolvedValue(mockHistory);
      mockSessionManager.getNextTurnNumber.mockResolvedValue(2);
      mockTaskExecutor.execute.mockResolvedValue({
        success: true,
        output: "Task completed",
        logs: ["Log 1", "Log 2"],
        duration: 1000,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/continue`,
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.turnNumber).toBe(2);
      expect(data.result).toBe("Task completed");
      expect(mockTaskExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          instruction: expect.stringContaining("Continue with this task"),
          options: expect.objectContaining({
            sdk: expect.objectContaining({
              continueSession: true,
              resumeSession: sessionId,
            }),
          }),
        }),
        expect.any(String), // taskId
      );
    });

    it("should return 404 if session not found", async () => {
      mockSessionManager.getSession.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions/non-existent/continue",
        payload: {
          sessionId: "non-existent",
          instruction: "Test",
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Session not found");
    });

    it("should return 400 if session is not active", async () => {
      const mockSession: Session = {
        id: "session-123",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions/session-123/continue",
        payload: {
          sessionId: "session-123",
          instruction: "Test",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Session is not active");
    });
  });

  describe("DELETE /api/sessions/:id", () => {
    it("should delete a session", async () => {
      mockSessionManager.deleteSession.mockResolvedValue(undefined);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/sessions/session-123",
      });

      expect(response.statusCode).toBe(204);
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith("session-123");
    });

    it("should handle errors during deletion", async () => {
      mockSessionManager.deleteSession.mockRejectedValue(new Error("Session not found"));

      const response = await app.inject({
        method: "DELETE",
        url: "/api/sessions/non-existent",
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Failed to delete session");
    });
  });

  describe("GET /api/sessions/:id/history", () => {
    it("should retrieve conversation history", async () => {
      const sessionId = "session-123";
      const mockHistory: ConversationTurn[] = [
        {
          id: 1,
          sessionId,
          turnNumber: 1,
          instruction: "First instruction",
          response: "First response",
          createdAt: new Date(),
        },
        {
          id: 2,
          sessionId,
          turnNumber: 2,
          instruction: "Second instruction",
          response: "Second response",
          createdAt: new Date(),
        },
      ];

      mockSessionManager.getConversationHistory.mockResolvedValue(mockHistory);

      const response = await app.inject({
        method: "GET",
        url: `/api/sessions/${sessionId}/history`,
        query: {
          limit: "10",
          offset: "0",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.sessionId).toBe(sessionId);
      expect(data.turns).toHaveLength(2);
      expect(data.totalTurns).toBe(2);
      expect(mockSessionManager.getConversationHistory).toHaveBeenCalledWith(sessionId, 10, 0);
    });
  });

  describe("GET /api/sessions", () => {
    it("should list active sessions", async () => {
      const mockSessions: Session[] = [
        {
          id: "session-1",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "session-2",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSessionManager.getActiveSessions.mockResolvedValue(mockSessions);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions",
        query: {
          status: "active",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.sessions).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(mockSessionManager.getActiveSessions).toHaveBeenCalled();
    });
  });
});
