import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sessionRoutes } from "../../../../src/server/routes/sessions";

// Mock session store
const mockSessionStore = {
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateSdkSessionId: vi.fn(),
  updateSdkState: vi.fn(),
};

const mockMessageStore = {
  add: vi.fn(),
  list: vi.fn(),
  getNextTurnNumber: vi.fn(),
};

const mockRuntime = {};

const mockSessionService = {
  sessions: mockSessionStore,
  messages: mockMessageStore,
  runtime: mockRuntime,
};

const mockTaskExecutor = {
  execute: vi.fn(),
};

vi.mock("../../../../src/claude/executor", () => ({
  TaskExecutorImpl: vi.fn(() => mockTaskExecutor),
}));

describe("Session Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    app.addHook("onRequest", async (request: FastifyRequest, _reply: FastifyReply) => {
      request.apiKey = "test-api-key";
    });

    await app.register(sessionRoutes, { sessionService: mockSessionService as any });
    await app.ready();
  });

  describe("POST /api/sessions", () => {
    it("should create a new session", async () => {
      const mockSession = {
        id: "sess-1",
        sessionType: "task",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSessionStore.create.mockReturnValue(mockSession);

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { type: "task", context: { workingDirectory: "/test" } },
      });

      expect(response.statusCode).toBe(201);
      expect(mockSessionStore.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "task" }),
      );
    });
  });

  describe("GET /api/sessions/:id", () => {
    it("should retrieve an existing session", async () => {
      const mockSession = {
        id: "sess-1",
        sessionType: "task",
        status: "active",
      };
      mockSessionStore.get.mockReturnValue(mockSession);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions/sess-1",
      });

      expect(response.statusCode).toBe(200);
    });

    it("should return 404 for non-existent session", async () => {
      mockSessionStore.get.mockReturnValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions/nonexistent",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/sessions/:id/continue", () => {
    it("should continue an active session", async () => {
      mockSessionStore.get.mockReturnValue({
        id: "sess-1",
        status: "active",
        context: {},
      });
      mockMessageStore.getNextTurnNumber.mockReturnValue(1);
      mockTaskExecutor.execute.mockResolvedValue({
        output: "Task result",
        duration: 100,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions/sess-1/continue",
        payload: { instruction: "Do something" },
      });

      expect(response.statusCode).toBe(200);
      expect(mockMessageStore.add).toHaveBeenCalledTimes(2); // user + agent
    });

    it("should return 400 for inactive session", async () => {
      mockSessionStore.get.mockReturnValue({
        id: "sess-1",
        status: "completed",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/sessions/sess-1/continue",
        payload: { instruction: "Do something" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/sessions/:id", () => {
    it("should delete a session", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/sessions/sess-1",
      });

      expect(response.statusCode).toBe(204);
      expect(mockSessionStore.delete).toHaveBeenCalledWith("sess-1");
    });
  });

  describe("GET /api/sessions", () => {
    it("should list sessions", async () => {
      mockSessionStore.list.mockReturnValue([
        { id: "sess-1", sessionType: "task" },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions?status=active",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
    });

    it("should filter by type", async () => {
      mockSessionStore.list.mockReturnValue([]);

      await app.inject({
        method: "GET",
        url: "/api/sessions?type=chat",
      });

      expect(mockSessionStore.list).toHaveBeenCalledWith(
        expect.objectContaining({ type: "chat" }),
      );
    });
  });

  describe("GET /api/sessions/:id/history", () => {
    it("should return message history", async () => {
      const messages = [
        { id: "m1", role: "user", content: "hello" },
        { id: "m2", role: "agent", content: "hi" },
      ];
      mockMessageStore.list.mockReturnValue(messages);

      const response = await app.inject({
        method: "GET",
        url: "/api/sessions/sess-1/history",
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
