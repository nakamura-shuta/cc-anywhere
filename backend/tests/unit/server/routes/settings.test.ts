import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import fastify from "fastify";
import { settingsRoutes } from "../../../../src/server/routes/settings";
// ClaudeCodeClient is mocked below

// Create a mock instance that will be returned by the constructor
const mockClaudeClientInstance = {
  isAvailable: vi.fn(),
  getCurrentMode: vi.fn(),
  switchStrategy: vi.fn(),
};

// Mock ClaudeCodeClient
vi.mock("../../../../src/claude/claude-code-client", () => ({
  ClaudeCodeClient: vi.fn().mockImplementation(() => mockClaudeClientInstance),
}));

// Mock logger
vi.mock("../../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Settings Routes", () => {
  let app: FastifyInstance;
  const testApiKey = "test-api-key";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create minimal Fastify app for testing
    app = fastify({ logger: false });

    // Register authentication plugin
    app.decorateRequest("isAuthenticated", false);
    app.addHook("preHandler", async (request, reply) => {
      const apiKey = request.headers["x-api-key"];
      if (apiKey !== testApiKey) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      request.isAuthenticated = true;
    });

    // Register routes
    await app.register(settingsRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/settings", () => {
    it("should return current settings with all modes available", async () => {
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("api-key");
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "api-key" || mode === "bedrock";
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        executionMode: "api-key",
        availableModes: ["api-key", "bedrock"],
        credentials: {
          apiKey: true,
          bedrock: true,
        },
      });
    });

    it("should return current settings with only api-key available", async () => {
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("api-key");
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "api-key";
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        executionMode: "api-key",
        availableModes: ["api-key"],
        credentials: {
          apiKey: true,
          bedrock: false,
        },
      });
    });

    it("should return current settings with only bedrock available", async () => {
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("bedrock");
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "bedrock";
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        executionMode: "bedrock",
        availableModes: ["bedrock"],
        credentials: {
          apiKey: false,
          bedrock: true,
        },
      });
    });

    it("should handle errors gracefully", async () => {
      mockClaudeClientInstance.getCurrentMode.mockImplementation(() => {
        throw new Error("Test error");
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Internal Server Error");
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/settings",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/settings", () => {
    it("should update execution mode to api-key", async () => {
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "api-key" || mode === "bedrock";
      });
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("api-key");

      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "api-key",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockClaudeClientInstance.switchStrategy).toHaveBeenCalledWith("api-key");
      expect(process.env.FORCE_EXECUTION_MODE).toBe("api-key");

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        executionMode: "api-key",
        availableModes: ["api-key", "bedrock"],
        credentials: {
          apiKey: true,
          bedrock: true,
        },
      });
    });

    it("should update execution mode to bedrock", async () => {
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "api-key" || mode === "bedrock";
      });
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("bedrock");

      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "bedrock",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockClaudeClientInstance.switchStrategy).toHaveBeenCalledWith("bedrock");
      expect(process.env.FORCE_EXECUTION_MODE).toBe("bedrock");

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        executionMode: "bedrock",
        availableModes: ["api-key", "bedrock"],
        credentials: {
          apiKey: true,
          bedrock: true,
        },
      });
    });

    it("should return error when switching to unavailable mode", async () => {
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "api-key"; // Only api-key is available
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "bedrock",
        },
      });

      expect(response.statusCode).toBe(500);
      expect(mockClaudeClientInstance.switchStrategy).not.toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.error).toBe("Internal Server Error");
    });

    it("should return 400 for invalid execution mode", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "invalid-mode",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Bad Request");
    });

    it("should return 400 for missing executionMode", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Bad Request");
    });

    it("should handle switch strategy errors", async () => {
      mockClaudeClientInstance.isAvailable.mockReturnValue(true);
      mockClaudeClientInstance.switchStrategy.mockImplementation(() => {
        throw new Error("Failed to switch strategy");
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "bedrock",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Internal Server Error");
    });

    it("should correctly build availableModes array", async () => {
      // Reset all mocks at the start
      vi.clearAllMocks();

      // Test when only api-key is available
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "api-key";
      });
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("api-key");
      mockClaudeClientInstance.switchStrategy.mockImplementation(() => {
        // Success - no error
      });

      let response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "api-key",
        },
      });

      expect(response.statusCode).toBe(200);
      let body = JSON.parse(response.body);
      expect(body.availableModes).toEqual(["api-key"]);

      // Test when only bedrock is available
      vi.clearAllMocks();
      mockClaudeClientInstance.isAvailable.mockImplementation((mode: string) => {
        return mode === "bedrock";
      });
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("bedrock");
      mockClaudeClientInstance.switchStrategy.mockImplementation(() => {
        // Success - no error
      });

      response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "bedrock",
        },
      });

      expect(response.statusCode).toBe(200);
      body = JSON.parse(response.body);
      expect(body.availableModes).toEqual(["bedrock"]);

      // Test when both are available
      vi.clearAllMocks();
      mockClaudeClientInstance.isAvailable.mockReturnValue(true);
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("api-key");
      mockClaudeClientInstance.switchStrategy.mockImplementation(() => {
        // Success - no error
      });

      response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "api-key",
        },
      });

      expect(response.statusCode).toBe(200);
      body = JSON.parse(response.body);
      expect(body.availableModes).toEqual(["api-key", "bedrock"]);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/settings",
        payload: {
          executionMode: "api-key",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("Environment variable persistence", () => {
    it("should persist FORCE_EXECUTION_MODE environment variable", async () => {
      const originalEnv = process.env.FORCE_EXECUTION_MODE;

      mockClaudeClientInstance.isAvailable.mockReturnValue(true);
      mockClaudeClientInstance.getCurrentMode.mockReturnValue("bedrock");

      await app.inject({
        method: "PUT",
        url: "/api/settings",
        headers: {
          "x-api-key": testApiKey,
        },
        payload: {
          executionMode: "bedrock",
        },
      });

      expect(process.env.FORCE_EXECUTION_MODE).toBe("bedrock");

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.FORCE_EXECUTION_MODE = originalEnv;
      } else {
        delete process.env.FORCE_EXECUTION_MODE;
      }
    });
  });
});
