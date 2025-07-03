import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";
import { config } from "../../../../src/config";

describe("POST /api/batch/tasks", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should create multiple tasks for different repositories", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/batch/tasks",
      headers: {
        "X-API-Key": "test-api-key",
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "npm audit fix",
        repositories: [
          { name: "app1", path: "/repos/app1" },
          { name: "app2", path: "/repos/app2" },
          { name: "app3", path: "/repos/app3" },
        ],
        options: {
          timeout: 300000,
        },
      },
    });

    if (response.statusCode !== 201) {
      console.error("Response body:", response.body);
    }
    
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    
    expect(body).toHaveProperty("groupId");
    expect(body).toHaveProperty("tasks");
    expect(body.tasks).toHaveLength(3);
    
    // 各タスクが正しく作成されているか確認
    body.tasks.forEach((task: any, index: number) => {
      expect(task).toHaveProperty("taskId");
      expect(task).toHaveProperty("repository");
      expect(task.repository).toBe(`app${index + 1}`);
      expect(task).toHaveProperty("status");
      expect(task.status).toBe("pending");
    });
  });

  it.skip("should validate required fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/batch/tasks",
      headers: {
        "X-API-Key": "test-api-key",
        "Content-Type": "application/json",
      },
      payload: {
        // instructionが不足
        repositories: [
          { name: "app1", path: "/repos/app1" },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    // Fastify schema validation returns error in a specific format
    const errorMessage = typeof body.error === 'object' ? body.error.message : body.error || body.message;
    expect(errorMessage).toContain("instruction");
  });

  it.skip("should require at least one repository", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/batch/tasks",
      headers: {
        "X-API-Key": "test-api-key",
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "npm audit fix",
        repositories: [], // 空の配列
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    // Schema validation for minItems:1 returns a different error message
    const errorMessage = typeof body.error === 'object' ? body.error.message : body.error || body.message;
    expect(errorMessage).toContain("repositories");
  });

  it("should use repository-specific options if provided", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/batch/tasks",
      headers: {
        "X-API-Key": "test-api-key",
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "npm test",
        repositories: [
          { 
            name: "app1", 
            path: "/repos/app1",
            timeout: 600000 // app1は長いタイムアウト
          },
          { 
            name: "app2", 
            path: "/repos/app2"
            // デフォルトのタイムアウトを使用
          },
        ],
        options: {
          timeout: 300000, // デフォルト
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.tasks).toHaveLength(2);
    
    // TODO: タスクの詳細を取得して、実際のタイムアウト値を確認
  });

  it("should handle authentication correctly", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/batch/tasks",
      headers: {
        // API Keyなし
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "npm audit fix",
        repositories: [
          { name: "app1", path: "/repos/app1" },
        ],
      },
    });

    expect(response.statusCode).toBe(401);
  });
});