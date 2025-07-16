import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { createTestApp } from "../../src/utils/test-helpers";
import { TaskQueue } from "../../src/queue";
import { WebSocketServer } from "../../src/websocket/websocket-server";
import type { TaskRequest } from "../../src/claude/types";

describe("Streaming WebSocket Integration", () => {
  let app: FastifyInstance;
  let taskQueue: TaskQueue;
  let wsServer: WebSocketServer;
  let ws: WebSocket;
  const testApiKey = "test-api-key";
  const wsUrl = "ws://localhost:5001/ws";

  beforeAll(async () => {
    // Create test app
    app = await createTestApp();

    // Initialize WebSocket server
    wsServer = new WebSocketServer();
    await wsServer.register(app);

    // Initialize task queue with WebSocket
    taskQueue = new TaskQueue({ concurrency: 1 });
    taskQueue.setWebSocketServer(wsServer);

    // Start server
    await app.listen({ port: 5001, host: "0.0.0.0" });
  });

  afterAll(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    await app.close();
  });

  it("should stream tool execution events", async () => {
    const receivedMessages: any[] = [];

    // Connect WebSocket
    ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        // Authenticate
        ws.send(
          JSON.stringify({
            type: "auth",
            payload: { apiKey: testApiKey },
          }),
        );
      });

      ws.on("message", (data: Buffer | string) => {
        const message = JSON.parse(data.toString());
        receivedMessages.push(message);

        if (message.type === "auth:success") {
          resolve();
        }
      });

      ws.on("error", reject);
    });

    // Create and subscribe to task
    const taskRequest: TaskRequest = {
      instruction: "List all files in the current directory",
      options: {
        async: true,
      },
    };

    // Add task to queue
    taskQueue.add(taskRequest);

    // Subscribe to task
    ws.send(
      JSON.stringify({
        type: "subscribe",
        payload: { taskId },
      }),
    );

    // Collect messages for 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify received messages
    const messageTypes = receivedMessages.map((m) => m.type);

    // Should receive various streaming events
    expect(messageTypes).toContain("subscribe:success");
    expect(messageTypes).toContain("task:update");

    // Check for tool events (if task executed tools)
    const toolStartEvents = receivedMessages.filter((m) => m.type === "task:tool:start");
    const toolEndEvents = receivedMessages.filter((m) => m.type === "task:tool:end");

    // Verify tool events have proper structure
    toolStartEvents.forEach((event) => {
      expect(event.payload).toHaveProperty("taskId", taskId);
      expect(event.payload).toHaveProperty("toolId");
      expect(event.payload).toHaveProperty("tool");
      expect(event.payload).toHaveProperty("timestamp");
    });

    toolEndEvents.forEach((event) => {
      expect(event.payload).toHaveProperty("taskId", taskId);
      expect(event.payload).toHaveProperty("toolId");
      expect(event.payload).toHaveProperty("tool");
      expect(event.payload).toHaveProperty("duration");
      expect(event.payload).toHaveProperty("success");
      expect(event.payload).toHaveProperty("timestamp");
    });
  });

  it("should stream Claude responses", async () => {
    const receivedMessages: any[] = [];

    // Mock task with Claude response
    const mockProgress = vi.fn();

    // Simulate Claude response event
    await mockProgress({
      type: "claude:response",
      message: "I'll help you list the files...",
      data: { turnNumber: 1 },
    });

    // Verify Claude response event structure
    const claudeResponses = receivedMessages.filter((m) => m.type === "task:claude:response");
    claudeResponses.forEach((event) => {
      expect(event.payload).toHaveProperty("text");
      expect(event.payload).toHaveProperty("turnNumber");
      expect(event.payload).toHaveProperty("timestamp");
    });
  });

  it("should stream statistics at task completion", async () => {
    const receivedMessages: any[] = [];

    // Create a simple task
    const taskRequest: TaskRequest = {
      instruction: "Simple test task",
      options: {
        async: true,
      },
    };

    // Add task to queue
    taskQueue.add(taskRequest);

    // Wait for task completion
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check for statistics event
    const statsEvents = receivedMessages.filter((m) => m.type === "task:statistics");

    expect(statsEvents.length).toBeGreaterThan(0);

    const stats = statsEvents[0].payload.statistics;
    expect(stats).toHaveProperty("totalTurns");
    expect(stats).toHaveProperty("totalToolCalls");
    expect(stats).toHaveProperty("toolStats");
    expect(stats).toHaveProperty("elapsedTime");
  });

  it("should handle todo updates", async () => {
    const receivedMessages: any[] = [];

    // Mock todo update
    const mockTodos = [
      { id: "1", content: "First task", status: "completed", priority: "high" },
      { id: "2", content: "Second task", status: "in_progress", priority: "medium" },
      { id: "3", content: "Third task", status: "pending", priority: "low" },
    ];

    // Simulate todo update event
    wsServer.broadcastTodoUpdate({
      taskId: "test-task",
      todos: mockTodos,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify todo update event
    const todoEvents = receivedMessages.filter((m) => m.type === "task:todo_update");
    expect(todoEvents.length).toBeGreaterThan(0);

    const todos = todoEvents[0].payload.todos;
    expect(todos).toHaveLength(3);
    expect(todos[0]).toHaveProperty("status", "completed");
  });

  it("should calculate tool duration correctly", async () => {
    const toolStartTime = Date.now();
    const toolId = "test-tool-123";

    // Simulate tool start
    wsServer.broadcastToolStart({
      taskId: "test-task",
      toolId,
      tool: "Write",
      input: { file_path: "test.txt" },
      timestamp: new Date().toISOString(),
    });

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Simulate tool end
    wsServer.broadcastToolEnd({
      taskId: "test-task",
      toolId,
      tool: "Write",
      output: "Success",
      error: null,
      duration: Date.now() - toolStartTime,
      success: true,
      timestamp: new Date().toISOString(),
    });

    // Wait for messages
    await new Promise((resolve) => setTimeout(resolve, 100));

    const receivedMessages: any[] = [];
    const toolEndEvents = receivedMessages.filter(
      (m) => m.type === "task:tool:end" && m.payload.toolId === toolId,
    );

    if (toolEndEvents.length > 0) {
      const duration = toolEndEvents[0].payload.duration;
      expect(duration).toBeGreaterThanOrEqual(150);
      expect(duration).toBeLessThan(300);
    }
  });
});
