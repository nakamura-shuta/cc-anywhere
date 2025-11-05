import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TaskQueueImpl } from "../../../src/queue";
import type { TaskRequest } from "../../../src/claude/types";
import { TaskStatus } from "../../../src/claude/types";

// Mock the executor
vi.mock("../../../src/claude/executor", () => ({
  TaskExecutorImpl: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

// Mock logger
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock shared repository to avoid database dependency
vi.mock("../../../src/db/shared-instance", () => ({
  getSharedRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateResult: vi.fn(),
    updateConversationHistory: vi.fn(),
    updateProgressData: vi.fn(),
    updateSdkSessionId: vi.fn(),
    getPendingTasks: vi.fn().mockReturnValue([]),
  })),
  getSharedDbProvider: vi.fn(),
  getSharedScheduleRepository: vi.fn().mockImplementation(() => ({
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
  getTypedEventBus: vi.fn().mockImplementation(() => ({
    emit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    getListenerCount: vi.fn().mockReturnValue(0),
  })),
}));

describe("TaskQueue", () => {
  let queue: TaskQueueImpl;
  let mockExecutor: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the shared repository mock for each test
    const { getSharedRepository } = await import("../../../src/db/shared-instance");
    const mockRepository = {
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateResult: vi.fn(),
      getPendingTasks: vi.fn().mockReturnValue([]),
    };
    (getSharedRepository as any).mockReturnValue(mockRepository);

    // Create queue with concurrency of 2
    queue = new TaskQueueImpl({ concurrency: 2, autoStart: false });

    // Get the mock executor instance
    const { TaskExecutorImpl } = await import("../../../src/claude/executor");
    mockExecutor = (TaskExecutorImpl as any).mock.results[0].value;
  });

  afterEach(async () => {
    if (queue) {
      // Stop the queue first to ensure no tasks are running
      queue.pause();
      queue.clear();
      // Wait a bit to ensure all tasks are cleaned up
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  describe("add", () => {
    it("should add task to queue and return task ID", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
      };

      const taskId = await queue.add(task);

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("should add task with priority", async () => {
      const task: TaskRequest = {
        instruction: "High priority task",
      };

      const taskId = await queue.add(task, 10);
      const queuedTask = queue.get(taskId);

      expect(queuedTask?.priority).toBe(10);
    });

    it("should set initial task status to pending", async () => {
      const task: TaskRequest = {
        instruction: "Test task",
      };

      const taskId = await queue.add(task);
      const queuedTask = queue.get(taskId);

      expect(queuedTask?.status).toBe(TaskStatus.PENDING);
      expect(queuedTask?.startedAt).toBeUndefined();
      expect(queuedTask?.completedAt).toBeUndefined();
    });
  });

  describe("get", () => {
    it("should return task by ID", async () => {
      const task: TaskRequest = {
        instruction: "Find me",
      };

      const taskId = await queue.add(task);
      const queuedTask = queue.get(taskId);

      expect(queuedTask).toBeDefined();
      expect(queuedTask?.id).toBe(taskId);
      expect(queuedTask?.request.instruction).toBe("Find me");
    });

    it("should return undefined for non-existent task", () => {
      const task = queue.get("non-existent-id");
      expect(task).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return all tasks sorted by status and priority", async () => {
      // Add tasks with different priorities
      await queue.add({ instruction: "Low priority" }, 1);
      await queue.add({ instruction: "High priority" }, 10);
      await queue.add({ instruction: "Medium priority" }, 5);

      const tasks = queue.getAll();

      expect(tasks).toHaveLength(3);
      // Should be sorted by priority (high to low) when all are pending
      expect(tasks[0].priority).toBe(10);
      expect(tasks[1].priority).toBe(5);
      expect(tasks[2].priority).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return queue statistics", async () => {
      await queue.add({ instruction: "Task 1" });
      await queue.add({ instruction: "Task 2" });

      const stats = queue.getStats();

      expect(stats.size).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.isPaused).toBe(true); // autoStart is false so queue is paused
    });
  });

  describe("task execution", () => {
    it("should execute tasks when queue starts", async () => {
      const successResult = {
        success: true,
        output: "Task completed",
        logs: ["Log 1", "Log 2"],
        duration: 100,
      };

      mockExecutor.execute.mockResolvedValue(successResult);

      const taskId = await queue.add({ instruction: "Execute me" });

      // Start the queue
      queue.start();

      // Wait for task to complete
      await queue.waitForIdle();

      const task = queue.get(taskId);
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.result).toBe("Task completed");
      expect(task?.startedAt).toBeDefined();
      expect(task?.completedAt).toBeDefined();
    });

    it("should handle task failure", async () => {
      const failureResult = {
        success: false,
        error: new Error("Task failed"),
        logs: ["Error occurred"],
        duration: 50,
      };

      mockExecutor.execute.mockResolvedValue(failureResult);

      const taskId = await queue.add({ instruction: "Fail me" });
      queue.start();

      await queue.waitForIdle();

      const task = queue.get(taskId);
      expect(task?.status).toBe(TaskStatus.FAILED);
      expect(task?.error?.message).toBe("Task failed");
      expect(task?.result).toBeUndefined(); // 失敗時はresultがundefined
    });

    it("should respect concurrency limit", async () => {
      // Slow task execution
      mockExecutor.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          success: true,
          output: "Done",
          logs: [],
          duration: 100,
        };
      });

      // Add 4 tasks to queue with concurrency of 2
      const taskIds = await Promise.all([
        queue.add({ instruction: "Task 1" }),
        queue.add({ instruction: "Task 2" }),
        queue.add({ instruction: "Task 3" }),
        queue.add({ instruction: "Task 4" }),
      ]);

      queue.start();

      // Check immediately - only 2 should be running
      await new Promise((resolve) => setTimeout(resolve, 50));

      const runningTasks = queue.getAll().filter((t) => t.status === TaskStatus.RUNNING);
      expect(runningTasks.length).toBeLessThanOrEqual(2);

      await queue.waitForIdle();

      // All should be completed
      taskIds.forEach((id) => {
        const task = queue.get(id);
        expect(task?.status).toBe(TaskStatus.COMPLETED);
      });
    });
  });

  describe("queue control", () => {
    it("should pause and resume queue", async () => {
      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: "Done",
        logs: [],
        duration: 50,
      });

      await queue.add({ instruction: "Task 1" });
      await queue.add({ instruction: "Task 2" });

      queue.start();
      queue.pause();

      const stats = queue.getStats();
      expect(stats.isPaused).toBe(true);

      queue.start();
      expect(queue.getStats().isPaused).toBe(false);
    });

    it("should clear pending tasks", async () => {
      await queue.add({ instruction: "Task 1" });
      await queue.add({ instruction: "Task 2" });

      queue.clear();

      const tasks = queue.getAll();
      tasks.forEach((task) => {
        expect(task.status).toBe(TaskStatus.CANCELLED);
      });
    });

    it("should update concurrency", () => {
      expect(queue.concurrency).toBe(2);

      queue.concurrency = 5;

      expect(queue.concurrency).toBe(5);
    });
  });

  describe("event handlers", () => {
    it("should call onComplete handler", async () => {
      const onComplete = vi.fn();
      queue.onTaskComplete(onComplete);

      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: "Done",
        logs: [],
        duration: 50,
      });

      await queue.add({ instruction: "Complete me" });
      queue.start();
      await queue.waitForIdle();

      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.COMPLETED,
        }),
      );
    });

    it("should call onError handler", async () => {
      const onError = vi.fn();
      queue.onTaskError(onError);

      const error = new Error("Task error");
      mockExecutor.execute.mockResolvedValue({
        success: false,
        error,
        logs: [],
        duration: 50,
      });

      await queue.add({ instruction: "Error me" });
      queue.start();
      await queue.waitForIdle();

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.FAILED,
        }),
        error,
      );
    });

    it("should handle errors in event handlers gracefully", async () => {
      const onComplete = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });

      queue.onTaskComplete(onComplete);

      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: "Done",
        logs: [],
        duration: 50,
      });

      await queue.add({ instruction: "Complete me" });
      queue.start();

      // Should not throw
      await expect(queue.waitForIdle()).resolves.not.toThrow();
    });
  });

  describe("task with options", () => {
    it("should pass task options to executor", async () => {
      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: "Done",
        logs: [],
        duration: 50,
      });

      const task: TaskRequest = {
        instruction: "Task with options",
        context: {
          // Don't specify workingDirectory to avoid path validation
          files: ["file1.ts", "file2.ts"],
        },
        options: {
          timeout: 60000,
          allowedTools: ["Read", "Write"],
        },
      };

      await queue.add(task);
      queue.start();
      await queue.waitForIdle();

      expect(mockExecutor.execute).toHaveBeenCalledWith(task, expect.any(String), undefined);
    });
  });
});
