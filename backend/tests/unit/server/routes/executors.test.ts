/**
 * Executors API Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { executorRoutes } from "../../../../src/server/routes/executors.js";

// Mock config to enable auth
vi.mock("../../../../src/config", () => ({
  config: {
    auth: {
      enabled: true,
      apiKey: "test-api-key",
    },
  },
}));

// Mock AgentExecutorFactory
vi.mock("../../../../src/agents/agent-executor-factory.js", () => ({
  AgentExecutorFactory: {
    getAvailableExecutors: vi.fn(() => ["claude", "codex"]),
  },
}));

// Mock logger
vi.mock("../../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Executors Routes", () => {
  let app: FastifyInstance;
  const testApiKey = "test-api-key";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create minimal Fastify app for testing
    app = fastify({ logger: false });

    // Register routes
    await app.register(executorRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/executors", () => {
    it("should return list of available executors", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty("executors");
      expect(Array.isArray(body.executors)).toBe(true);
      expect(body.executors.length).toBeGreaterThan(0);

      // Check structure of each executor
      body.executors.forEach((executor: any) => {
        expect(executor).toHaveProperty("type");
        expect(executor).toHaveProperty("available");
        expect(executor).toHaveProperty("description");
        expect(typeof executor.type).toBe("string");
        expect(typeof executor.available).toBe("boolean");
        expect(typeof executor.description).toBe("string");
      });
    });

    it("should include Claude executor in response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const claudeExecutor = body.executors.find((e: any) => e.type === "claude");
      expect(claudeExecutor).toBeDefined();
      expect(claudeExecutor.available).toBe(true);
    });

    it("should include Codex executor in response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const codexExecutor = body.executors.find((e: any) => e.type === "codex");
      expect(codexExecutor).toBeDefined();
      expect(codexExecutor.available).toBe(true);
    });

    it("should handle case when some executors are not available", async () => {
      // Mock only Claude as available
      const { AgentExecutorFactory } = await import(
        "../../../../src/agents/agent-executor-factory.js"
      );
      vi.mocked(AgentExecutorFactory.getAvailableExecutors).mockResolvedValueOnce(["claude"]);

      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const claudeExecutor = body.executors.find((e: any) => e.type === "claude");
      const codexExecutor = body.executors.find((e: any) => e.type === "codex");

      expect(claudeExecutor?.available).toBe(true);
      expect(codexExecutor?.available).toBe(false);
    });
  });
});
