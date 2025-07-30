import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";

// Mock config to enable auth
vi.mock("../../../../src/config", () => ({
  config: {
    auth: {
      enabled: true,
      apiKey: "test-api-key",
    },
    server: { port: 3000 },
    cors: { origin: "*" },
    websocket: { enabled: false },
    worktree: { enabled: false },
    isDevelopment: false,
    logging: { level: "info" },
    claude: { apiKey: "test-claude-key" },
    tasks: { defaultTimeout: 300000 },
    claudeCodeSDK: { defaultMaxTurns: 3 },
    database: { path: ":memory:" },
    queue: { concurrency: 1, retryLimit: 3 },
    worker: { mode: "inline" },
  },
}));

import { config } from "../../../../src/config";

describe("GET /api/batch/tasks/:groupId/status", () => {
  let app: FastifyInstance;
  let testGroupId: string;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();

    // テスト用のバッチタスクを作成
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/batch/tasks",
      headers: {
        "X-API-Key": config.auth.apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "echo 'test'",
        repositories: [
          { name: "app1", path: "/repos/app1" },
          { name: "app2", path: "/repos/app2" },
        ],
      },
    });

    const body = JSON.parse(createResponse.body);
    testGroupId = body.groupId;
  });

  afterEach(async () => {
    await app.close();
  });

  it.skip("should return status summary for batch tasks", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/batch/tasks/${testGroupId}/status`,
      headers: {
        "X-API-Key": config.auth.apiKey,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty("groupId", testGroupId);
    expect(body).toHaveProperty("summary");
    expect(body.summary).toHaveProperty("total", 2);
    expect(body.summary).toHaveProperty("pending");
    expect(body.summary).toHaveProperty("running");
    expect(body.summary).toHaveProperty("completed");
    expect(body.summary).toHaveProperty("failed");
    expect(body).toHaveProperty("tasks");
    expect(body.tasks).toHaveLength(2);
  });

  it.skip("should return 404 for non-existent group", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/batch/tasks/non-existent-group/status",
      headers: {
        "X-API-Key": config.auth.apiKey,
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toContain("not found");
  });

  it("should require authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/batch/tasks/${testGroupId}/status`,
      // API Keyなし
    });

    expect(response.statusCode).toBe(401);
  });
});
