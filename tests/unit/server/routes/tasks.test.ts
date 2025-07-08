import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../../src/server/app";
import { getSharedRepository, closeSharedServices } from "../../../../src/db/shared-instance";
import { v4 as uuidv4 } from "uuid";
import { TaskStatus } from "../../../../src/claude/types";

vi.mock("../../../../src/db/shared-instance", () => ({
  getSharedDbProvider: vi.fn().mockImplementation(() => ({
    getDb: vi.fn(),
  })),
  getSharedRepository: vi.fn(),
  getSharedBatchTaskRepository: vi.fn().mockReturnValue({}),
  getSharedWorktreeRepository: vi.fn().mockReturnValue({}),
  getSharedBatchTaskService: vi.fn().mockReturnValue({}),
  closeSharedServices: vi.fn(),
}));

vi.mock("../../../../src/queue/task-queue", () => ({
  TaskQueueImpl: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockReturnValue("test-task-id"),
    get: vi.fn(),
    setWebSocketServer: vi.fn(),
    onTaskComplete: vi.fn(),
    onTaskError: vi.fn(),
  })),
}));

vi.mock("../../../../src/websocket/websocket-server", () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    broadcastTaskUpdate: vi.fn(),
    broadcastTaskLog: vi.fn(),
  })),
}));

vi.mock("../../../../src/events", () => ({
  getTypedEventBus: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

describe("Task Routes", () => {
  let app: FastifyInstance;
  let mockRepository: any;

  beforeEach(async () => {
    // Mock repository
    mockRepository = {
      find: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      toQueuedTask: vi.fn(),
    };

    vi.mocked(getSharedRepository).mockReturnValue(mockRepository);

    app = await createApp({ logger: false });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.clearAllMocks();
    closeSharedServices();
  });

  describe("GET /api/tasks", () => {
    it("should return tasks with workingDirectory", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/project/my-repo";

      const mockRecord = {
        id: taskId,
        instruction: "Test task",
        context: { workingDirectory },
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task",
          context: { workingDirectory },
          options: {},
        },
        status: TaskStatus.COMPLETED,
        priority: 0,
        addedAt: mockRecord.createdAt,
        startedAt: mockRecord.startedAt,
        completedAt: mockRecord.completedAt,
        result: {
          taskId,
          status: TaskStatus.COMPLETED,
          instruction: "Test task",
          createdAt: mockRecord.createdAt,
          startedAt: mockRecord.startedAt,
          completedAt: mockRecord.completedAt,
          result: { message: "Task completed" },
        },
      };

      mockRepository.find.mockReturnValue({
        data: [mockRecord],
        total: 1,
        limit: 20,
        offset: 0,
      });

      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-api-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0]).toMatchObject({
        taskId,
        status: TaskStatus.COMPLETED,
        instruction: "Test task",
        workingDirectory,
      });

      // Ensure workingDirectory is explicitly included
      expect(body.tasks[0].workingDirectory).toBe(workingDirectory);
    });

    it("should handle tasks without workingDirectory", async () => {
      const taskId = uuidv4();

      const mockRecord = {
        id: taskId,
        instruction: "Test task",
        context: {}, // No workingDirectory
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task",
          context: {},
          options: {},
        },
        status: TaskStatus.COMPLETED,
        priority: 0,
        addedAt: mockRecord.createdAt,
        startedAt: mockRecord.startedAt,
        completedAt: mockRecord.completedAt,
      };

      mockRepository.find.mockReturnValue({
        data: [mockRecord],
        total: 1,
        limit: 20,
        offset: 0,
      });

      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-api-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0].workingDirectory).toBeUndefined();
    });
  });

  describe("GET /api/tasks/:taskId", () => {
    it("should return task with workingDirectory", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/project/my-repo";

      const mockRecord = {
        id: taskId,
        instruction: "Test task",
        context: { workingDirectory },
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
        repositoryName: "my-repo",
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task",
          context: { workingDirectory },
          options: {},
        },
        status: TaskStatus.COMPLETED,
        priority: 0,
        addedAt: mockRecord.createdAt,
        startedAt: mockRecord.startedAt,
        completedAt: mockRecord.completedAt,
        result: {
          taskId,
          status: TaskStatus.COMPLETED,
          instruction: "Test task",
          createdAt: mockRecord.createdAt,
          startedAt: mockRecord.startedAt,
          completedAt: mockRecord.completedAt,
          result: { message: "Task completed" },
        },
      };

      mockRepository.getById.mockReturnValue(mockRecord);
      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "GET",
        url: `/api/tasks/${taskId}`,
        headers: {
          "X-API-Key": "test-api-key",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toMatchObject({
        taskId,
        status: TaskStatus.COMPLETED,
        instruction: "Test task",
        workingDirectory,
        repositoryName: "my-repo",
      });

      // Ensure workingDirectory is explicitly included
      expect(body.workingDirectory).toBe(workingDirectory);
    });
  });

  describe("POST /api/tasks", () => {
    it("should create task with workingDirectory", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/project/my-repo";

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task",
          context: { workingDirectory },
          options: {},
        },
        status: TaskStatus.PENDING,
        priority: 0,
        addedAt: new Date(),
      };

      // Get the mocked queue instance
      const mockQueue = app.queue as any;
      mockQueue.add = vi.fn().mockReturnValue(taskId);
      mockQueue.get = vi.fn().mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": "test-api-key",
          "Content-Type": "application/json",
        },
        payload: {
          instruction: "Test task",
          context: { workingDirectory },
          options: { async: true },
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);

      expect(body).toMatchObject({
        taskId,
        status: TaskStatus.PENDING,
        instruction: "Test task",
        workingDirectory,
      });

      // Ensure workingDirectory is explicitly included
      expect(body.workingDirectory).toBe(workingDirectory);
    });
  });
});
