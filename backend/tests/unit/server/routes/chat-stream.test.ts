import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";
import jwt from "jsonwebtoken";

// Mock the chat repository and executor
vi.mock("../../../../src/db/shared-instance", () => ({
  getSharedDbProvider: vi.fn().mockReturnValue({
    getDb: vi.fn(),
  }),
  getDatabaseInstance: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    transaction: vi.fn().mockImplementation((fn) => fn),
  }),
  getSharedRepository: vi.fn(),
  getSharedBatchTaskRepository: vi.fn(),
  getSharedWorktreeRepository: vi.fn(),
  getSharedBatchTaskService: vi.fn().mockReturnValue({
    createBatchTasks: vi.fn(),
    getBatchTaskStatus: vi.fn(),
  }),
  getSharedScheduleRepository: vi.fn().mockReturnValue({
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
  getSharedChatRepository: vi.fn().mockReturnValue({
    sessions: {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findSessionsByUserId: vi.fn(),
      delete: vi.fn(),
      updateSdkSessionId: vi.fn(),
    },
    messages: {
      create: vi.fn(),
      findBySessionId: vi.fn(),
      countBySessionId: vi.fn(),
      deleteBySessionId: vi.fn(),
    },
    characters: {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByIdAndUserId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }),
}));

// Mock config
vi.mock("../../../../src/config/index", async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("../../../../src/config/index")>(
    "../../../../src/config/index",
  );
  return {
    ...actual,
    config: {
      ...actual.config,
      auth: {
        enabled: false,
        apiKey: undefined,
      },
      chat: {
        streamTokenSecret: "test-secret-key-for-jwt-signing",
        streamTokenExpirySeconds: 300,
      },
    },
  };
});

describe("Chat Stream Routes", () => {
  let app: FastifyInstance;
  let mockChatRepository: any;
  const apiKey = "test-key";
  // When auth is disabled, getUserId returns "default-user"
  const userId = "default-user";

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp({ logger: false });

    // Get the mocked repository
    const { getSharedChatRepository } = await import("../../../../src/db/shared-instance");
    mockChatRepository = (getSharedChatRepository as any)();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/chat/sessions/:sessionId/stream-token", () => {
    it("should generate a stream token for valid session", async () => {
      mockChatRepository.sessions.findById.mockResolvedValue({
        id: "session-123",
        userId,
        characterId: "default",
        executor: "claude",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/chat/sessions/session-123/stream-token",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.token).toBeDefined();
      expect(body.expiresAt).toBeDefined();

      // Verify token is valid JWT
      const decoded = jwt.decode(body.token) as any;
      expect(decoded.sessionId).toBe("session-123");
      expect(decoded.userId).toBe(userId);
    });

    it("should return 404 for non-existent session", async () => {
      mockChatRepository.sessions.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/chat/sessions/non-existent/stream-token",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 404 for session belonging to different user", async () => {
      mockChatRepository.sessions.findById.mockResolvedValue({
        id: "session-123",
        userId: "other-user",
        characterId: "default",
        executor: "claude",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/chat/sessions/session-123/stream-token",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // Note: WebSocket endpoint tests require actual WebSocket connections
  // which are difficult to test with Fastify's inject method.
  // The token validation is tested above in the stream-token tests.
  // Full WebSocket integration tests would require a separate test setup.
  describe("GET /api/chat/sessions/:sessionId/ws (WebSocket)", () => {
    it.skip("WebSocket tests require actual WebSocket connections", () => {
      // WebSocket endpoints cannot be tested with app.inject()
      // Integration tests with actual WebSocket clients are recommended
    });
  });
});
