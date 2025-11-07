import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../src/server/app.js";
import type { TaskRequest, TaskResponse } from "../../src/claude/types.js";

// Mock Codex SDK
const mockCodex = {
  startThread: vi.fn(),
  resumeThread: vi.fn(),
};

const mockThread = {
  runStreamed: vi.fn(),
};

vi.mock("@openai/codex-sdk", () => ({
  Codex: vi.fn(() => mockCodex),
}));

describe("Codex Session Continuation", () => {
  let app: FastifyInstance;
  let apiKey: string;

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.ready();
    apiKey = process.env.API_KEY || "test-api-key";

    // Setup default mock behavior
    mockCodex.startThread.mockReturnValue(mockThread);
    mockCodex.resumeThread.mockReturnValue(mockThread);

    // Default mock response for runStreamed
    mockThread.runStreamed.mockResolvedValue({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "test-thread-123" };
        yield {
          type: "item.completed",
          item: {
            id: "item-1",
            type: "agent_message",
            text: "Task completed",
          },
        };
        yield {
          type: "turn.completed",
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      })(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/tasks with Codex options", () => {
    it("should accept codex.continueSession and codex.resumeSession parameters", async () => {
      const threadId = "thread-789abc";
      const request: TaskRequest = {
        instruction: "Continue previous conversation",
        context: {
          workingDirectory: "/tmp/test-repo",
        },
        options: {
          timeout: 30000,
          async: true,
          executor: "codex",
          codex: {
            sandboxMode: "workspace-write",
            continueSession: true,
            resumeSession: threadId,
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
      expect(body.status).toBe("pending");
    });

    it("should accept codex.sandboxMode parameter", async () => {
      const request: TaskRequest = {
        instruction: "Test sandbox mode",
        context: {
          workingDirectory: "/tmp/test-repo",
        },
        options: {
          timeout: 30000,
          async: true,
          executor: "codex",
          codex: {
            sandboxMode: "read-only",
            skipGitRepoCheck: true,
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

      expect(response.statusCode).toBe(202);
      const body = response.json<TaskResponse>();
      expect(body.taskId).toBeDefined();
    });

    it("should accept codex.model parameter", async () => {
      const request: TaskRequest = {
        instruction: "Test with specific model",
        context: {
          workingDirectory: "/tmp/test-repo",
        },
        options: {
          timeout: 30000,
          async: true,
          executor: "codex",
          codex: {
            sandboxMode: "workspace-write",
            model: "gpt-4",
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

      expect(response.statusCode).toBe(202);
      const body = response.json<TaskResponse>();
      expect(body.taskId).toBeDefined();
    });

    it("should reject invalid sandboxMode value", async () => {
      const request = {
        instruction: "Test invalid sandbox mode",
        context: {
          workingDirectory: "/tmp/test-repo",
        },
        options: {
          timeout: 30000,
          async: true,
          executor: "codex",
          codex: {
            sandboxMode: "invalid-mode", // Invalid value
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

      expect(response.statusCode).toBe(400); // Bad request
    });

    it("should allow continueSession without resumeSession (fallback to new session)", async () => {
      const request: TaskRequest = {
        instruction: "Start new session with continueSession flag",
        context: {
          workingDirectory: "/tmp/test-repo",
        },
        options: {
          timeout: 30000,
          async: true,
          executor: "codex",
          codex: {
            sandboxMode: "workspace-write",
            continueSession: true,
            // No resumeSession - should fallback to new thread
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

      expect(response.statusCode).toBe(202);
      const body = response.json<TaskResponse>();
      expect(body.taskId).toBeDefined();
    });
  });
});
