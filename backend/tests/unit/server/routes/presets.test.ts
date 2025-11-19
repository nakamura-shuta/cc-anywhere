import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Mock fs module
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock logger
vi.mock("../../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Claude client
vi.mock("../../../../src/claude/claude-code-client", () => ({
  ClaudeCodeClient: vi.fn().mockImplementation(() => ({})),
}));

// Mock database
vi.mock("../../../../src/db/shared-instance", () => ({
  getSharedDbProvider: vi.fn().mockImplementation(() => ({
    getDb: vi.fn().mockReturnValue({
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([]),
      }),
    }),
  })),
  getDatabaseInstance: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    transaction: vi.fn().mockImplementation((fn) => fn),
  })),
  getSharedRepository: vi.fn().mockImplementation(() => ({
    find: vi.fn().mockReturnValue({ data: [], total: 0 }),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toQueuedTask: vi.fn(),
  })),
  getSharedBatchTaskService: vi.fn().mockImplementation(() => ({
    createBatchTasks: vi.fn(),
    getBatchTaskStatus: vi.fn(),
  })),
  getSharedScheduleRepository: vi.fn().mockImplementation(() => ({
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
  getSharedChatRepository: vi.fn().mockReturnValue({
    sessions: {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      delete: vi.fn(),
    },
    messages: {
      create: vi.fn(),
      findBySessionId: vi.fn(),
    },
    characters: {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByIdAndUserId: vi.fn(),
    },
  }),
}));

// Mock config
vi.mock("../../../../src/config", () => ({
  config: {
    server: { port: 3000 },
    cors: { origin: "*" },
    websocket: { enabled: false },
    queue: { concurrency: 1, retryLimit: 3 },
    worker: { mode: "inline" },
    claude: {
      apiKey: "test-claude-key",
    },
    tasks: {
      defaultTimeout: 300000,
    },
    claudeCodeSDK: {
      defaultMaxTurns: 3,
    },
    worktree: {
      enabled: false,
    },
    database: {
      path: ":memory:",
    },
    auth: {
      enabled: true,
      apiKey: "test-api-key",
    },
    isDevelopment: false,
    logging: { level: "info" },
  },
}));

const mockPresets = {
  presets: [
    {
      id: "default",
      name: "デフォルト設定",
      description: "一般的なタスク用の標準設定",
      isSystem: true,
      settings: {
        sdk: {
          maxTurns: 3,
          permissionMode: "ask",
          allowedTools: ["Read", "Write", "Edit"],
          outputFormat: "text",
        },
        timeout: 600000,
        useWorktree: false,
      },
    },
  ],
  userPresets: [
    {
      id: "user-1",
      name: "カスタム設定",
      description: "ユーザー定義の設定",
      isSystem: false,
      settings: {
        sdk: {
          maxTurns: 5,
          permissionMode: "allow",
        },
        timeout: 900000,
      },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ],
};

describe("Preset Routes", () => {
  let app: FastifyInstance;
  const apiKey = "test-api-key";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up environment
    process.env.API_KEY = apiKey;

    // Mock file system by default
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPresets));
    vi.mocked(writeFileSync).mockReturnValue(undefined);

    app = await createApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.API_KEY;
  });

  describe("GET /api/presets", () => {
    it("should return all presets", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty("presets");
      expect(data).toHaveProperty("userPresets");
      expect(data.presets).toHaveLength(1);
      expect(data.userPresets).toHaveLength(1);
    });

    it("should create default file if not exists", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const response = await app.inject({
        method: "GET",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(writeFileSync).toHaveBeenCalledWith(
        join(process.cwd(), "config", "task-presets.json"),
        expect.any(String),
      );
    });

    it("should handle file read errors", async () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("File read error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Failed to load presets");
    });

    it("should require API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/presets",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/presets/:id", () => {
    it("should return a specific system preset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/presets/default",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("default");
      expect(data.name).toBe("デフォルト設定");
      expect(data.isSystem).toBe(true);
    });

    it("should return a specific user preset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/presets/user-1",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("user-1");
      expect(data.name).toBe("カスタム設定");
      expect(data.isSystem).toBe(false);
    });

    it("should return 404 for non-existent preset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/presets/non-existent",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Preset not found");
    });
  });

  describe("POST /api/presets", () => {
    it("should create a new user preset", async () => {
      const newPreset = {
        name: "新しいプリセット",
        description: "テスト用プリセット",
        settings: {
          sdk: {
            maxTurns: 7,
            permissionMode: "deny",
          },
          timeout: 1200000,
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(newPreset),
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.name).toBe(newPreset.name);
      expect(data.description).toBe(newPreset.description);
      expect(data.settings).toEqual(newPreset.settings);
      expect(data.isSystem).toBe(false);
      expect(data.id).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();

      // Check if file was saved
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should reject duplicate preset names", async () => {
      const duplicatePreset = {
        name: "デフォルト設定", // Already exists
        settings: {
          sdk: { maxTurns: 1 },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(duplicatePreset),
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Preset with this name already exists");
    });

    it("should validate required fields", async () => {
      const invalidPreset = {
        // Missing name
        settings: {
          sdk: { maxTurns: 1 },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(invalidPreset),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /api/presets/:id", () => {
    it("should update a user preset", async () => {
      const updates = {
        name: "更新されたプリセット",
        settings: {
          sdk: {
            maxTurns: 10,
          },
        },
      };

      const response = await app.inject({
        method: "PUT",
        url: "/api/presets/user-1",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.name).toBe(updates.name);
      expect(data.settings.sdk.maxTurns).toBe(10);
      expect(data.updatedAt).toBeDefined();

      // Check if file was saved
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should not allow updating system presets", async () => {
      const updates = {
        name: "変更しようとする",
      };

      const response = await app.inject({
        method: "PUT",
        url: "/api/presets/default",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("System presets cannot be modified");
    });

    it("should return 404 for non-existent preset", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/presets/non-existent",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "test" }),
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Preset not found");
    });
  });

  describe("DELETE /api/presets/:id", () => {
    it("should delete a user preset", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/presets/user-1",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Preset deleted successfully");

      // Check if file was saved
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should not allow deleting system presets", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/presets/default",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("System presets cannot be deleted");
    });

    it("should return 404 for non-existent preset", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/presets/non-existent",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Preset not found");
    });
  });

  describe("File operations", () => {
    it("should handle write errors gracefully", async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error("Write error");
      });

      const newPreset = {
        name: "エラーテスト",
        settings: { sdk: { maxTurns: 1 } },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(newPreset),
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Failed to create preset");
    });

    it("should handle invalid JSON in file", async () => {
      vi.mocked(readFileSync).mockReturnValue("invalid json");

      const response = await app.inject({
        method: "GET",
        url: "/api/presets",
        headers: {
          "x-api-key": apiKey,
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.message).toBe("Failed to load presets");
    });
  });
});
