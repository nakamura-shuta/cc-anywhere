/**
 * Executors Capabilities Integration Tests
 * Tests for executor capabilities API endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../src/server/app.js";

describe("Executors Capabilities Integration", () => {
  let server: FastifyInstance;
  const testApiKey = process.env.API_KEY || "test-api-key";

  beforeAll(async () => {
    server = await createApp();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("GET /api/executors", () => {
    it("should return executors with capabilities", async () => {
      const response = await server.inject({
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

      // Verify each executor has capabilities
      body.executors.forEach((executor: any) => {
        expect(executor).toHaveProperty("type");
        expect(executor).toHaveProperty("available");
        expect(executor).toHaveProperty("description");
        expect(executor).toHaveProperty("capabilities");

        // Verify capabilities structure
        const caps = executor.capabilities;
        expect(caps).toHaveProperty("sessionContinuation");
        expect(caps).toHaveProperty("sessionResume");
        expect(caps).toHaveProperty("crossRepositorySession");
        expect(caps).toHaveProperty("maxTurnsLimit");
        expect(caps).toHaveProperty("toolFiltering");
        expect(caps).toHaveProperty("permissionModes");
        expect(caps).toHaveProperty("customSystemPrompt");
        expect(caps).toHaveProperty("outputFormatting");
        expect(caps).toHaveProperty("verboseMode");
        expect(caps).toHaveProperty("sandboxControl");
        expect(caps).toHaveProperty("modelSelection");
        expect(caps).toHaveProperty("webSearch");

        // All capabilities should be boolean
        Object.values(caps).forEach((value) => {
          expect(typeof value).toBe("boolean");
        });
      });
    });

    it("should return different capabilities for different executors", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/executors",
        headers: {
          "x-api-key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      const claude = body.executors.find((e: any) => e.type === "claude");
      const codex = body.executors.find((e: any) => e.type === "codex");

      // Claude should support these features
      expect(claude?.capabilities.maxTurnsLimit).toBe(true);
      expect(claude?.capabilities.permissionModes).toBe(true);
      expect(claude?.capabilities.toolFiltering).toBe(true);

      // Codex should NOT support these features
      expect(codex?.capabilities.maxTurnsLimit).toBe(false);
      expect(codex?.capabilities.permissionModes).toBe(false);
      expect(codex?.capabilities.toolFiltering).toBe(false);

      // Codex should support these features
      expect(codex?.capabilities.sandboxControl).toBe(true);
      expect(codex?.capabilities.modelSelection).toBe(true);

      // Claude should NOT support these features
      expect(claude?.capabilities.sandboxControl).toBe(false);
      expect(claude?.capabilities.modelSelection).toBe(false);
    });

    it("should be accessible without authentication if auth is disabled", async () => {
      // This test assumes auth might be disabled in test environment
      const response = await server.inject({
        method: "GET",
        url: "/api/executors",
      });

      // Should either succeed or require auth, but not fail for other reasons
      expect([200, 401, 403]).toContain(response.statusCode);
    });
  });
});
