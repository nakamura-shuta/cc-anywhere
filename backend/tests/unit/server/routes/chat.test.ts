import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";

// Mock the chat repository
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

// Mock config to disable auth
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
    },
  };
});

describe("Chat Routes", () => {
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

  describe("Session endpoints", () => {
    describe("POST /api/chat/sessions", () => {
      it("should create a new session", async () => {
        mockChatRepository.sessions.create.mockResolvedValue({
          id: "session-123",
          userId,
          characterId: "default",
          executor: "claude",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await app.inject({
          method: "POST",
          url: "/api/chat/sessions",
          headers: {
            "X-API-Key": apiKey,
          },
          payload: {
            characterId: "default",
            executor: "claude",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          characterId: "default",
          executor: "claude",
        });
        expect(body.id).toBeDefined();
        expect(mockChatRepository.sessions.create).toHaveBeenCalled();
      });

      it("should validate required fields", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/chat/sessions",
          headers: {
            "X-API-Key": apiKey,
          },
          payload: {},
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe("GET /api/chat/sessions", () => {
      it("should list user sessions", async () => {
        mockChatRepository.sessions.findByUserId.mockResolvedValue({
          items: [
            {
              id: "session-1",
              userId,
              characterId: "default",
              executor: "claude",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/sessions",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.items).toHaveLength(1);
        expect(body.total).toBe(1);
      });
    });

    describe("GET /api/chat/sessions/:sessionId", () => {
      it("should get session by id", async () => {
        mockChatRepository.sessions.findById.mockResolvedValue({
          id: "session-123",
          userId,
          characterId: "default",
          executor: "claude",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/sessions/session-123",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe("session-123");
      });

      it("should return 404 for non-existent session", async () => {
        mockChatRepository.sessions.findById.mockResolvedValue(null);

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/sessions/non-existent",
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
          method: "GET",
          url: "/api/chat/sessions/session-123",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe("DELETE /api/chat/sessions/:sessionId", () => {
      it("should delete session", async () => {
        mockChatRepository.sessions.findById.mockResolvedValue({
          id: "session-123",
          userId,
        });
        mockChatRepository.sessions.delete.mockResolvedValue(true);

        const response = await app.inject({
          method: "DELETE",
          url: "/api/chat/sessions/session-123",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(mockChatRepository.sessions.delete).toHaveBeenCalledWith("session-123");
      });
    });
  });

  describe("Message endpoints", () => {
    describe("GET /api/chat/sessions/:sessionId/messages", () => {
      it("should get messages for session", async () => {
        mockChatRepository.sessions.findById.mockResolvedValue({
          id: "session-123",
          userId,
        });
        mockChatRepository.messages.findBySessionId.mockResolvedValue([
          {
            id: "msg-1",
            sessionId: "session-123",
            role: "user",
            content: "Hello",
            createdAt: new Date(),
          },
          {
            id: "msg-2",
            sessionId: "session-123",
            role: "agent",
            content: "Hi there!",
            createdAt: new Date(),
          },
        ]);

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/sessions/session-123/messages",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.messages).toHaveLength(2);
        expect(body.count).toBe(2);
      });
    });

    describe("POST /api/chat/sessions/:sessionId/messages", () => {
      it("should create a user message", async () => {
        mockChatRepository.sessions.findById.mockResolvedValue({
          id: "session-123",
          userId,
        });
        mockChatRepository.messages.create.mockResolvedValue({
          id: "msg-1",
          sessionId: "session-123",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        });

        const response = await app.inject({
          method: "POST",
          url: "/api/chat/sessions/session-123/messages",
          headers: {
            "X-API-Key": apiKey,
          },
          payload: {
            content: "Hello",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.role).toBe("user");
        expect(body.content).toBe("Hello");
      });
    });
  });

  describe("Character endpoints", () => {
    describe("GET /api/chat/characters", () => {
      it("should list built-in and custom characters", async () => {
        mockChatRepository.characters.findByUserId.mockResolvedValue([
          {
            id: "char-1",
            userId,
            name: "My Character",
            systemPrompt: "Custom prompt",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/characters",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.builtIn).toHaveLength(1);
        expect(body.builtIn[0].id).toBe("default");
        expect(body.custom).toHaveLength(1);
        expect(body.custom[0].name).toBe("My Character");
      });
    });

    describe("POST /api/chat/characters", () => {
      it("should create a custom character", async () => {
        mockChatRepository.characters.create.mockResolvedValue({
          id: "char-123",
          userId,
          name: "New Character",
          systemPrompt: "You are helpful",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await app.inject({
          method: "POST",
          url: "/api/chat/characters",
          headers: {
            "X-API-Key": apiKey,
          },
          payload: {
            name: "New Character",
            systemPrompt: "You are helpful",
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.name).toBe("New Character");
        expect(body.systemPrompt).toBe("You are helpful");
      });
    });

    describe("GET /api/chat/characters/:characterId", () => {
      it("should get built-in character", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/api/chat/characters/default",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe("default");
        expect(body.isBuiltIn).toBe(true);
      });

      it("should get custom character", async () => {
        mockChatRepository.characters.findByIdAndUserId.mockResolvedValue({
          id: "char-123",
          userId,
          name: "My Character",
          systemPrompt: "Custom prompt",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/characters/char-123",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe("char-123");
        expect(body.isBuiltIn).toBe(false);
      });

      it("should return 404 for non-existent character", async () => {
        mockChatRepository.characters.findByIdAndUserId.mockResolvedValue(null);

        const response = await app.inject({
          method: "GET",
          url: "/api/chat/characters/non-existent",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe("PUT /api/chat/characters/:characterId", () => {
      it("should update a character", async () => {
        mockChatRepository.characters.findByIdAndUserId.mockResolvedValue({
          id: "char-123",
          userId,
          name: "Old Name",
          systemPrompt: "Old prompt",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        mockChatRepository.characters.update.mockResolvedValue({
          id: "char-123",
          userId,
          name: "New Name",
          systemPrompt: "Old prompt",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await app.inject({
          method: "PUT",
          url: "/api/chat/characters/char-123",
          headers: {
            "X-API-Key": apiKey,
          },
          payload: {
            name: "New Name",
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.name).toBe("New Name");
      });
    });

    describe("DELETE /api/chat/characters/:characterId", () => {
      it("should delete a character", async () => {
        mockChatRepository.characters.findByIdAndUserId.mockResolvedValue({
          id: "char-123",
          userId,
        });
        mockChatRepository.characters.delete.mockResolvedValue(true);

        const response = await app.inject({
          method: "DELETE",
          url: "/api/chat/characters/char-123",
          headers: {
            "X-API-Key": apiKey,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(mockChatRepository.characters.delete).toHaveBeenCalledWith("char-123");
      });
    });
  });
});
