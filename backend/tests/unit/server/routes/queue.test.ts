import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";
import { TaskStatus } from "../../../../src/claude/types";

// Mock the queue implementation
vi.mock("../../../../src/queue", () => ({
  TaskQueueImpl: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    getStats: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    clear: vi.fn(),
    onTaskComplete: vi.fn(),
    onTaskError: vi.fn(),
    setWebSocketServer: vi.fn(),
    concurrency: 2,
  })),
}));

describe("Queue Routes", () => {
  let app: FastifyInstance;
  let mockQueue: any;
  const apiKey = "test-key";

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp({ logger: false });
    mockQueue = app.queue as any;
  });

  describe("POST /api/queue/tasks", () => {
    it("should add task to queue", async () => {
      const taskId = "task-123";
      mockQueue.add.mockResolvedValue(taskId);
      mockQueue.get.mockReturnValue({
        id: taskId,
        status: TaskStatus.PENDING,
        request: { instruction: "Test task" },
        priority: 0,
        addedAt: new Date(),
      });
      mockQueue.getStats.mockReturnValue({
        size: 1,
        pending: 1,
        running: 0,
        completed: 0,
        failed: 0,
        isPaused: false,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/queue/tasks",
        headers: {
          "X-API-Key": apiKey,
        },
        payload: {
          instruction: "Test task",
          priority: 5,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        taskId,
        position: 1,
        status: TaskStatus.PENDING,
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        {
          instruction: "Test task",
          options: {
            sdk: {
              enableHooks: true,
              hookConfig: undefined,
            },
          },
        },
        5,
      );
    });

    it("should add task with context and options", async () => {
      const taskId = "task-456";
      mockQueue.add.mockResolvedValue(taskId);
      mockQueue.get.mockReturnValue({
        id: taskId,
        status: TaskStatus.PENDING,
      });
      mockQueue.getStats.mockReturnValue({ pending: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/api/queue/tasks",
        headers: {
          "X-API-Key": apiKey,
        },
        payload: {
          instruction: "Complex task",
          context: {
            workingDirectory: "/project",
            files: ["file1.ts"],
          },
          options: {
            timeout: 60000,
            allowedTools: ["Read"],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockQueue.add).toHaveBeenCalledWith(
        {
          instruction: "Complex task",
          context: {
            workingDirectory: "/project",
            files: ["file1.ts"],
          },
          options: {
            timeout: 60000,
            allowedTools: ["Read"],
            sdk: {
              enableHooks: true,
              hookConfig: undefined,
            },
          },
        },
        0, // default priority
      );
    });
  });

  describe("GET /api/queue/stats", () => {
    it("should return queue statistics", async () => {
      mockQueue.getStats.mockReturnValue({
        size: 10,
        pending: 5,
        running: 2,
        completed: 3,
        failed: 0,
        isPaused: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/queue/stats",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        size: 10,
        pending: 5,
        running: 2,
        completed: 3,
        failed: 0,
        isPaused: false,
        concurrency: 2,
      });
    });
  });

  describe("GET /api/queue/tasks", () => {
    it("should return all tasks with pagination", async () => {
      const tasks = [
        {
          id: "task-1",
          request: { instruction: "Task 1" },
          status: TaskStatus.COMPLETED,
          priority: 0,
          addedAt: new Date("2024-01-01"),
          startedAt: new Date("2024-01-01"),
          completedAt: new Date("2024-01-01"),
        },
        {
          id: "task-2",
          request: { instruction: "Task 2" },
          status: TaskStatus.PENDING,
          priority: 5,
          addedAt: new Date("2024-01-02"),
        },
      ];

      mockQueue.getAll.mockReturnValue(tasks);

      const response = await app.inject({
        method: "GET",
        url: "/api/queue/tasks?limit=10&offset=0",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(2);
      expect(body.tasks).toHaveLength(2);
      expect(body.tasks[0]).toMatchObject({
        id: "task-1",
        instruction: "Task 1",
        status: TaskStatus.COMPLETED,
      });
    });

    it("should filter tasks by status", async () => {
      const allTasks = [
        {
          id: "task-1",
          request: { instruction: "Task 1" },
          status: TaskStatus.COMPLETED,
          priority: 0,
          addedAt: new Date(),
        },
        {
          id: "task-2",
          request: { instruction: "Task 2" },
          status: TaskStatus.PENDING,
          priority: 0,
          addedAt: new Date(),
        },
      ];

      mockQueue.getAll.mockReturnValue(allTasks);

      const response = await app.inject({
        method: "GET",
        url: "/api/queue/tasks?status=pending",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.tasks[0].status).toBe(TaskStatus.PENDING);
    });
  });

  describe("GET /api/queue/tasks/:taskId", () => {
    it("should return specific task", async () => {
      const task = {
        id: "task-123",
        request: { instruction: "Get me" },
        status: TaskStatus.COMPLETED,
        priority: 0,
        addedAt: new Date(),
        result: {
          taskId: "task-123",
          status: TaskStatus.COMPLETED,
          instruction: "Get me",
          result: "Task completed",
        },
      };

      mockQueue.get.mockReturnValue(task);

      const response = await app.inject({
        method: "GET",
        url: "/api/queue/tasks/task-123",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        taskId: "task-123",
        status: TaskStatus.COMPLETED,
        result: "Task completed",
      });
    });

    it("should return 404 for non-existent task", async () => {
      mockQueue.get.mockReturnValue(undefined);

      const response = await app.inject({
        method: "GET",
        url: "/api/queue/tasks/non-existent",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Queue control endpoints", () => {
    it("should start queue", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/queue/start",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueue.start).toHaveBeenCalled();
    });

    it("should pause queue", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/queue/pause",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it("should clear queue", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/queue/clear",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueue.clear).toHaveBeenCalled();
    });
  });

  describe("PUT /api/queue/concurrency", () => {
    it("should update queue concurrency", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/queue/concurrency",
        headers: {
          "X-API-Key": apiKey,
        },
        payload: {
          concurrency: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueue.concurrency).toBe(5);
    });

    it("should validate concurrency limits", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/queue/concurrency",
        headers: {
          "X-API-Key": apiKey,
        },
        payload: {
          concurrency: 15, // exceeds max
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
