import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../src/server/app";
import { TaskStatus } from "../../src/claude/types";
import { v4 as uuidv4 } from "uuid";

// Mock Claude Code SDK
vi.mock("@anthropic-ai/claude-code", () => ({
  query: vi.fn().mockImplementation(async function* (params: any) {
    console.log("Mock query called with params:", JSON.stringify(params, null, 2));

    // Simulate SDK behavior
    const sessionId = params.options?.resume || `new-session-${uuidv4()}`;

    yield {
      type: "system",
      message: "Starting task",
    };

    yield {
      type: "assistant",
      message: { content: [{ type: "text", text: "Processing..." }] },
      session_id: sessionId, // Include session ID in response
    };

    // Simulate different responses based on prompt
    if (params.prompt.includes("フィボナッチ")) {
      yield {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "フィボナッチ数列の最初の10項は: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34",
            },
          ],
        },
      };
    } else if (params.options?.resume && params.prompt.includes("第7項")) {
      // If resuming session and asking about specific terms
      yield {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "先ほど計算したフィボナッチ数列の第7項は8、第8項は13でした。",
            },
          ],
        },
      };
    } else {
      yield {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "I don't have context from previous conversation.",
            },
          ],
        },
      };
    }

    yield {
      type: "result",
      result: "Task completed",
      subtype: "success",
    };
  }),
}));

describe("SDK Continue Integration Tests", () => {
  let app: FastifyInstance;
  const apiKey = process.env.API_KEY || "hello";

  beforeAll(async () => {
    app = await createApp({
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should save SDK session ID when task completes", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "Calculate フィボナッチ numbers",
        options: {
          sdk: {
            maxTurns: 2,
          },
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const task = response.json();
    expect(task.status).toBe(TaskStatus.COMPLETED);

    // Get task details to check SDK session ID
    const detailsResponse = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.taskId}`,
      headers: {
        "X-API-Key": apiKey,
      },
    });

    expect(detailsResponse.statusCode).toBe(200);
    const taskDetails = detailsResponse.json();
    expect(taskDetails.sdkSessionId).toBeDefined();
    expect(taskDetails.sdkSessionId).toMatch(/^new-session-/);
  });

  it("should continue from previous task using SDK session ID", async () => {
    // First task
    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "Calculate フィボナッチ numbers",
        options: {
          sdk: {
            maxTurns: 2,
          },
        },
      },
    });

    expect(firstResponse.statusCode).toBe(201);
    const firstTask = firstResponse.json();
    const firstTaskId = firstTask.taskId;

    // Continue from first task
    const continueResponse = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "What was the 第7項 and 第8項?",
        options: {
          sdk: {
            continueFromTaskId: firstTaskId,
          },
        },
      },
    });

    expect(continueResponse.statusCode).toBe(201);
    const continueTask = continueResponse.json();
    expect(continueTask.status).toBe(TaskStatus.COMPLETED);

    // Check that the response includes context from previous conversation
    expect(continueTask.result).toBeTruthy();

    // Handle the result regardless of its format (string or serialized object)
    let resultText: string;
    if (typeof continueTask.result === "string") {
      resultText = continueTask.result;
    } else if (typeof continueTask.result === "object") {
      // If it's the weird character-by-character object, reconstruct the string
      const chars = Object.values(continueTask.result);
      resultText = chars.join("");
    } else {
      resultText = String(continueTask.result);
    }

    // Verify that the AI remembers the previous conversation
    // The response should mention that it calculated Fibonacci numbers previously
    expect(resultText).toContain("先ほど計算した");

    // Verify that it mentions the specific Fibonacci terms
    expect(resultText).toContain("第7項は8");
    expect(resultText).toContain("第8項は13");
  });

  it("should return 404 when continuing from non-existent task", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "Test",
        options: {
          sdk: {
            continueFromTaskId: "non-existent-task-id",
          },
        },
      },
    });

    expect(response.statusCode).toBe(404);
    const error = response.json();
    expect(error.error.code).toBe("TASK_NOT_FOUND");
  });

  it("should return 400 when previous task has no SDK session ID", async () => {
    // Create a task without SDK session ID (simulate old task)
    const taskId = uuidv4();
    const repository = app.repository;
    repository.create({
      id: taskId,
      instruction: "Old task without SDK session",
      status: TaskStatus.COMPLETED,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "Continue from old task",
        options: {
          sdk: {
            continueFromTaskId: taskId,
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const error = response.json();
    expect(error.error.code).toBe("INVALID_TASK_REQUEST");
  });

  it("should work with async tasks", async () => {
    // First async task
    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "Calculate フィボナッチ numbers",
        options: {
          async: true,
          sdk: {
            maxTurns: 2,
          },
        },
      },
    });

    expect(firstResponse.statusCode).toBe(202);
    const firstTask = firstResponse.json();
    const firstTaskId = firstTask.taskId;

    // Wait for task to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Continue from first task (also async)
    const continueResponse = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      payload: {
        instruction: "What was the result?",
        options: {
          async: true,
          sdk: {
            continueFromTaskId: firstTaskId,
          },
        },
      },
    });

    expect(continueResponse.statusCode).toBe(202);
    const continueTask = continueResponse.json();
    expect(continueTask.taskId).toBeDefined();
  });
});
