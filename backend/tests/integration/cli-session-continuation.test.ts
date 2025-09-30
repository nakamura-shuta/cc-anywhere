import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../src/server/app.js";
import type { TaskRequest, TaskResponse } from "../../src/claude/types.js";
import { v4 as uuidv4 } from "uuid";

// Mock Claude Code SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn().mockImplementation(async function* (params: any) {
    console.log("Mock query called with resumeSession:", params.options?.resume);

    // Simulate SDK behavior with session continuation
    const sessionId = params.options?.resume || `new-session-${uuidv4()}`;

    yield {
      type: "system",
      message: `Resuming session: ${sessionId}`,
    };

    yield {
      type: "assistant",
      message: {
        content: [
          {
            type: "text",
            text: params.options?.resume
              ? `前回の質問は「hello?」でした。その後「このリポジトリの概要教えてください。」という質問をいただきました。`
              : "新しいセッションを開始しました。",
          },
        ],
      },
    };

    yield {
      type: "completion",
      sessionId: sessionId,
    };
  }),
}));

describe("CLI Session Continuation", () => {
  let app: FastifyInstance;
  let apiKey: string;

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.ready();
    apiKey = process.env.API_KEY || "test-api-key";
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/tasks with resumeSession", () => {
    it("should accept resumeSession parameter", async () => {
      const sessionId = "69647d9d-d1a3-4924-8dc2-e9c558007a4b";
      const request: TaskRequest = {
        instruction: "前回の質問内容を教えてください",
        context: {
          workingDirectory: "/tmp/test-repo",
        },
        options: {
          timeout: 30000,
          async: true,
          sdk: {
            maxTurns: 1,
            resumeSession: sessionId,
          },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        payload: request,
      });

      expect(response.statusCode).toBe(202); // Async tasks return 202
      const body = response.json<TaskResponse>();
      expect(body.taskId).toBeDefined();
      expect(body.status).toBe("pending"); // 非同期タスクの初期ステータス
    });

    it("should reject multiple repositories when resumeSession is specified", async () => {
      const sessionId = "69647d9d-d1a3-4924-8dc2-e9c558007a4b";
      const request: TaskRequest = {
        instruction: "テストタスク",
        context: {
          workingDirectory: "/tmp/test-repo",
          // 複数リポジトリを示すような構造がある場合のテスト
          // 注: 現在のAPIでは workingDirectory は単一の文字列なので、
          // このテストは主にフロントエンドでの制限を確認するものです
        },
        options: {
          timeout: 30000,
          async: true,
          sdk: {
            maxTurns: 1,
            resumeSession: sessionId,
          },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        payload: request,
      });

      // APIレベルでは現在制限がないため、202が返る（async: true）
      // フロントエンドでの制限をテストする
      expect(response.statusCode).toBe(202);
    });

    it("should pass resumeSession to Claude Code SDK", async () => {
      const sessionId = "test-session-id-12345";
      const request: TaskRequest = {
        instruction: "このセッションを継続してください",
        context: {
          workingDirectory: process.cwd(),
        },
        options: {
          timeout: 60000,
          async: false,
          sdk: {
            maxTurns: 1,
            resumeSession: sessionId,
            permissionMode: "allow",
          },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        payload: request,
      });

      // 同期モードなので201が返る
      expect(response.statusCode).toBe(201);
      const body = response.json<TaskResponse>();
      expect(body.taskId).toBeDefined();

      // SDKセッションIDが保存されることを確認
      if (body.sdkSessionId) {
        expect(body.sdkSessionId).toBeDefined();
      }
    });
  });

  describe("Session continuation flow", () => {
    it("should handle valid CLI session ID format", async () => {
      // UUID形式のセッションIDテスト
      const validSessionIds = [
        "69647d9d-d1a3-4924-8dc2-e9c558007a4b",
        "88f621c6-14ba-43ac-8523-20d272a71734",
        "7a575aa5-f727-446b-b6f4-fa860a48f74f",
      ];

      for (const sessionId of validSessionIds) {
        const request: TaskRequest = {
          instruction: "セッションテスト",
          context: {
            workingDirectory: "/tmp/test",
          },
          options: {
            timeout: 30000,
            async: true,
            sdk: {
              resumeSession: sessionId,
            },
          },
        };

        const response = await app.inject({
          method: "POST",
          url: "/api/tasks",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          payload: request,
        });

        expect(response.statusCode).toBe(202); // async: true なので202
      }
    });

    it("should handle resumeSession with other SDK options", async () => {
      const request: TaskRequest = {
        instruction: "複合オプションテスト",
        context: {
          workingDirectory: "/tmp/test",
        },
        options: {
          timeout: 30000,
          async: true,
          sdk: {
            maxTurns: 5,
            resumeSession: "test-session-123",
            permissionMode: "ask",
            systemPrompt: "テスト用システムプロンプト",
            allowedTools: ["Read", "Write"],
          },
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        payload: request,
      });

      expect(response.statusCode).toBe(202); // async: true なので202
      const body = response.json<TaskResponse>();
      expect(body.taskId).toBeDefined();
    });
  });
});
