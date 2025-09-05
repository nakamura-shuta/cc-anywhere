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
  getDatabaseInstance: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
    transaction: vi.fn().mockImplementation((fn) => fn),
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
  const testApiKey = process.env.API_KEY || "hoge";

  beforeEach(async () => {
    // Mock repository
    mockRepository = {
      find: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      toQueuedTask: vi.fn().mockImplementation((record) => {
        // Default implementation for toQueuedTask
        return {
          id: record.id,
          request: {
            instruction: record.instruction,
            context: record.context,
            options: record.options,
          },
          status: record.status,
          priority: record.priority,
          addedAt: record.createdAt,
          startedAt: record.startedAt,
          completedAt: record.completedAt,
          retryMetadata: record.retryMetadata,
          result: record.result,
          error: record.error,
        };
      }),
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
          "X-API-Key": testApiKey,
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
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0].workingDirectory).toBeUndefined();
    });

    it("should include sdkSessionId in task list response", async () => {
      const taskId = uuidv4();
      const sdkSessionId = "session-456";

      const mockRecord = {
        id: taskId,
        instruction: "Test task with session",
        context: {},
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
        sdkSessionId,
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task with session",
          context: {},
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
          instruction: "Test task with session",
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

      // Note: The sdkSessionId is taken directly from the record in the route
      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0]).toMatchObject({
        taskId,
        status: TaskStatus.COMPLETED,
        instruction: "Test task with session",
        sdkSessionId,
      });
    });

    it("should filter tasks by repository", async () => {
      const repo1Task = {
        id: uuidv4(),
        instruction: "Task in repo1",
        context: { workingDirectory: "/Users/test/repo1" },
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
      };

      // const repo2Task = {
      //   id: uuidv4(),
      //   instruction: "Task in repo2",
      //   context: { workingDirectory: "/Users/test/repo2" },
      //   options: {},
      //   priority: 0,
      //   status: TaskStatus.RUNNING,
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      //   startedAt: new Date(),
      // };

      const mockQueuedTask1 = {
        id: repo1Task.id,
        request: {
          instruction: repo1Task.instruction,
          context: repo1Task.context,
          options: {},
        },
        status: repo1Task.status,
        priority: 0,
        addedAt: repo1Task.createdAt,
        startedAt: repo1Task.startedAt,
        completedAt: repo1Task.completedAt,
        result: {
          taskId: repo1Task.id,
          status: repo1Task.status,
          instruction: repo1Task.instruction,
          createdAt: repo1Task.createdAt,
          startedAt: repo1Task.startedAt,
          completedAt: repo1Task.completedAt,
          result: { message: "Task completed" },
        },
      };

      // Mock repository.find to return all tasks (repository filter is applied after)
      mockRepository.find.mockReturnValue({
        data: [repo1Task],
        total: 1,
        limit: 1000,
        offset: 0,
      });

      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask1);

      // Test filtering by repository
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks?repository=repo1",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0].instruction).toBe("Task in repo1");
      expect(body.tasks[0].workingDirectory).toBe("/Users/test/repo1");

      // Verify that repository.find was called to get all tasks
      expect(mockRepository.find).toHaveBeenCalledWith({}, { limit: 1000, offset: 0 });
    });

    it("should filter tasks by both status and repository", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/repo1";

      const mockRecord = {
        id: taskId,
        instruction: "Running task in repo1",
        context: { workingDirectory },
        options: {},
        priority: 0,
        status: TaskStatus.RUNNING,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: mockRecord.instruction,
          context: mockRecord.context,
          options: {},
        },
        status: mockRecord.status,
        priority: 0,
        addedAt: mockRecord.createdAt,
        startedAt: mockRecord.startedAt,
        result: {
          taskId,
          status: mockRecord.status,
          instruction: mockRecord.instruction,
          createdAt: mockRecord.createdAt,
          startedAt: mockRecord.startedAt,
        },
      };

      mockRepository.find.mockImplementation((filter: any) => {
        if (filter.status === TaskStatus.RUNNING) {
          return {
            data: [mockRecord],
            total: 1,
            limit: 1000,
            offset: 0,
          };
        }
        return {
          data: [],
          total: 0,
          limit: 1000,
          offset: 0,
        };
      });

      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "GET",
        url: `/api/tasks?status=${TaskStatus.RUNNING}&repository=repo1`,
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0].status).toBe(TaskStatus.RUNNING);
      expect(body.tasks[0].workingDirectory).toBe(workingDirectory);

      // Verify that repository.find was called with status filter only
      expect(mockRepository.find).toHaveBeenCalledWith(
        {
          status: TaskStatus.RUNNING,
        },
        { limit: 1000, offset: 0 },
      );
    });

    it("should return empty result when filtering by non-existent repository", async () => {
      const existingTask = {
        id: uuidv4(),
        instruction: "Task in test repo",
        context: { workingDirectory: "/Users/test/test-repo" },
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
      };

      const mockQueuedTask = {
        id: existingTask.id,
        request: {
          instruction: existingTask.instruction,
          context: existingTask.context,
          options: {},
        },
        status: existingTask.status,
        priority: 0,
        addedAt: existingTask.createdAt,
        startedAt: existingTask.startedAt,
        completedAt: existingTask.completedAt,
      };

      // Return the existing task
      mockRepository.find.mockReturnValue({
        data: [existingTask],
        total: 1,
        limit: 1000,
        offset: 0,
      });

      mockRepository.toQueuedTask.mockReturnValue(mockQueuedTask);

      // Filter by non-existent repository
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks?repository=rust-asm",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should return empty results, not the existing task
      expect(body.tasks).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it("should use partial matching for repository filter", async () => {
      const task1 = {
        id: uuidv4(),
        instruction: "Task 1",
        context: { workingDirectory: "/Users/test/my-awesome-repo" },
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
      };

      const task2 = {
        id: uuidv4(),
        instruction: "Task 2",
        context: { workingDirectory: "/projects/awesome-project" },
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
      };

      const mockQueuedTask1 = {
        id: task1.id,
        request: {
          instruction: task1.instruction,
          context: task1.context,
          options: {},
        },
        status: task1.status,
        priority: 0,
        addedAt: task1.createdAt,
        startedAt: task1.startedAt,
        completedAt: task1.completedAt,
      };

      const mockQueuedTask2 = {
        id: task2.id,
        request: {
          instruction: task2.instruction,
          context: task2.context,
          options: {},
        },
        status: task2.status,
        priority: 0,
        addedAt: task2.createdAt,
        startedAt: task2.startedAt,
        completedAt: task2.completedAt,
      };

      mockRepository.find.mockReturnValue({
        data: [task1, task2],
        total: 2,
        limit: 1000,
        offset: 0,
      });

      mockRepository.toQueuedTask
        .mockReturnValueOnce(mockQueuedTask1)
        .mockReturnValueOnce(mockQueuedTask2);

      // Search for "awesome" - should match both tasks
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks?repository=awesome",
        headers: {
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.tasks).toHaveLength(2);
      expect(body.total).toBe(2);
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
          "X-API-Key": testApiKey,
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

    it("should include sdkSessionId in task detail response", async () => {
      const taskId = uuidv4();
      const sdkSessionId = "session-789";

      const mockRecord = {
        id: taskId,
        instruction: "Test task with session",
        context: {},
        options: {},
        priority: 0,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        startedAt: new Date(),
        sdkSessionId,
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task with session",
          context: {},
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
          instruction: "Test task with session",
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
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.sdkSessionId).toBe(sdkSessionId);
      expect(body.taskId).toBe(taskId);
    });

    it("should return task with worktree options", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/project/my-repo";
      const worktreeOptions = {
        enabled: true,
        baseBranch: "main",
        keepAfterCompletion: true,
      };

      const mockRecord = {
        id: taskId,
        instruction: "Test task with worktree",
        context: { workingDirectory },
        options: {
          useWorktree: true,
          worktree: worktreeOptions,
        },
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
          instruction: "Test task with worktree",
          context: { workingDirectory },
          options: {
            useWorktree: true,
            worktree: worktreeOptions,
          },
        },
        status: TaskStatus.COMPLETED,
        priority: 0,
        addedAt: mockRecord.createdAt,
        startedAt: mockRecord.startedAt,
        completedAt: mockRecord.completedAt,
        result: {
          taskId,
          status: TaskStatus.COMPLETED,
          instruction: "Test task with worktree",
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
          "X-API-Key": testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        taskId,
        status: TaskStatus.COMPLETED,
        instruction: "Test task with worktree",
        workingDirectory,
        options: {
          useWorktree: true,
          worktree: worktreeOptions,
        },
      });

      // Ensure worktree options are explicitly included
      expect(body.options.useWorktree).toBe(true);
      expect(body.options.worktree).toEqual(worktreeOptions);
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
          "X-API-Key": testApiKey,
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

    it("should create task with worktree options", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/project/my-repo";
      const worktreeOptions = {
        enabled: true,
        baseBranch: "main",
        keepAfterCompletion: true,
      };

      const mockQueuedTask = {
        id: taskId,
        request: {
          instruction: "Test task with worktree",
          context: { workingDirectory },
          options: {
            useWorktree: true,
            worktree: worktreeOptions,
          },
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
          "X-API-Key": testApiKey,
          "Content-Type": "application/json",
        },
        payload: {
          instruction: "Test task with worktree",
          context: { workingDirectory },
          options: {
            async: true,
            useWorktree: true,
            worktree: worktreeOptions,
          },
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        taskId,
        status: TaskStatus.PENDING,
        instruction: "Test task with worktree",
        workingDirectory,
      });

      // Verify worktree options were passed to the queue
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          instruction: "Test task with worktree",
          context: { workingDirectory },
          options: expect.objectContaining({
            async: true,
            useWorktree: true,
            worktree: worktreeOptions,
          }),
        }),
        0,
      );
    });

    it("should return sdkSessionId for synchronous task", async () => {
      const taskId = uuidv4();
      const workingDirectory = "/Users/test/project/my-repo";
      const sdkSessionId = "session-123";

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
        sdkSessionId,
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
          message: "Task completed",
          logs: ["Task started", "Task completed"],
        },
      };

      // Mock repository for sync task - will be called to get updated record
      mockRepository.getById.mockReturnValue(mockRecord);

      // Get the mocked queue instance
      const mockQueue = app.queue as any;
      mockQueue.add = vi.fn().mockReturnValue(taskId);
      mockQueue.get = vi.fn().mockReturnValue(mockQueuedTask);

      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          "X-API-Key": testApiKey,
          "Content-Type": "application/json",
        },
        payload: {
          instruction: "Test task",
          context: { workingDirectory },
          options: {},
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body).toMatchObject({
        taskId,
        status: TaskStatus.COMPLETED,
        instruction: "Test task",
        workingDirectory,
        result: { message: "Task completed" },
        logs: ["Task started", "Task completed"],
        sdkSessionId,
      });

      // resultプロパティが正しい構造を持っていることを確認
      expect(body.result).toEqual({
        message: "Task completed",
        logs: ["Task started", "Task completed"],
      });

      // Ensure sdkSessionId is explicitly included
      expect(body.sdkSessionId).toBe(sdkSessionId);

      // Verify repository.getById was called to fetch updated record
      expect(mockRepository.getById).toHaveBeenCalledWith(taskId);
    });
  });
});
