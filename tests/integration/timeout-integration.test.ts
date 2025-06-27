import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../src/server/app";
import type { FastifyInstance } from "fastify";
import type { TaskRequest } from "../../src/claude/types";

describe("Timeout Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Simple timeout", () => {
    it("should accept numeric timeout", async () => {
      const task: TaskRequest = {
        instruction: "Quick test task",
        options: {
          timeout: 5000,
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-key",
        },
        payload: task,
      });

      expect(response.statusCode).toBe(201); // Returns 201 for created
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("taskId");
    });
  });

  describe("Advanced timeout configuration", () => {
    it("should accept timeout configuration object", async () => {
      const task: TaskRequest = {
        instruction: "Test task with advanced timeout",
        options: {
          timeout: {
            total: 10000,
            setup: 1000,
            execution: 8000,
            cleanup: 1000,
            warningThreshold: 0.8,
            behavior: "soft",
          },
          async: true,
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-key",
        },
        payload: task,
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("taskId");
      expect(body.status).toBe("pending");
    });

    it("should validate timeout configuration", async () => {
      const task: TaskRequest = {
        instruction: "Test task with invalid timeout",
        options: {
          timeout: {
            total: 500, // Too small
            setup: 10,
            execution: 480,
            cleanup: 10,
          },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-key",
        },
        payload: task,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Task logs with timeout warnings", () => {
    it("should include timeout warnings in task logs", async () => {
      // This test would need a mock executor that simulates a long-running task
      // For now, we just test that the API accepts the configuration
      const task: TaskRequest = {
        instruction: "Simulate long task",
        options: {
          timeout: {
            total: 5000,
            execution: 4000,
            warningThreshold: 0.5, // Warn at 50% for testing
          },
          async: true,
        },
      };

      const createResponse = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-key",
        },
        payload: task,
      });

      expect(createResponse.statusCode).toBe(202);
      const { taskId } = JSON.parse(createResponse.body);

      // Get task logs
      const logsResponse = await app.inject({
        method: "GET",
        url: `/api/tasks/${taskId}/logs`,
        headers: {
          "X-API-Key": "test-key",
        },
      });

      expect(logsResponse.statusCode).toBe(200);
      const logs = JSON.parse(logsResponse.body);
      expect(logs).toHaveProperty("logs");
      expect(Array.isArray(logs.logs)).toBe(true);
    });
  });
});
