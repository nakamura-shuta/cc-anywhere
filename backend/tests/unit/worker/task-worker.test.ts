import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskWorker } from "../../../src/worker/task-worker";
import { TaskStatus } from "../../../src/claude/types";

// Mock dependencies
vi.mock("../../../src/queue/task-queue", () => {
  class MockTaskQueueImpl {
    private handlers = {
      complete: [] as Array<(task: any) => void>,
      error: [] as Array<(task: any, error: Error) => void>,
    };

    concurrency = 2;
    private isStarted = false;
    private isPaused = false;

    constructor(options: any) {
      this.concurrency = options.concurrency ?? 2;
    }

    onTaskComplete(handler: (task: any) => void) {
      this.handlers.complete.push(handler);
    }

    onTaskError(handler: (task: any, error: Error) => void) {
      this.handlers.error.push(handler);
    }

    start() {
      this.isStarted = true;
      this.isPaused = false;
    }

    pause() {
      this.isPaused = true;
    }

    getStats() {
      return {
        size: 5,
        pending: 3,
        running: 2,
        completed: 10,
        failed: 1,
        isPaused: this.isPaused,
      };
    }

    getAll() {
      return [
        {
          id: "task-1",
          status: TaskStatus.RUNNING,
          request: { instruction: "Test task 1" },
          priority: 0,
          addedAt: new Date(),
        },
        {
          id: "task-2",
          status: TaskStatus.PENDING,
          request: { instruction: "Test task 2" },
          priority: 1,
          addedAt: new Date(),
        },
      ];
    }

    async waitForIdle() {
      return Promise.resolve();
    }

    clear() {
      // Mock clear
    }

    // Simulate task completion for testing
    simulateTaskComplete(task: any) {
      this.handlers.complete.forEach((handler) => handler(task));
    }

    simulateTaskError(task: any, error: Error) {
      this.handlers.error.forEach((handler) => handler(task, error));
    }
  }

  return { TaskQueueImpl: MockTaskQueueImpl };
});

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("TaskWorker", () => {
  let worker: TaskWorker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });

  describe("initialization", () => {
    it("should create worker with default options", () => {
      worker = new TaskWorker();
      expect(worker).toBeDefined();
      expect(worker.isHealthy()).toBe(false); // Not started yet
    });

    it("should create worker with custom options", () => {
      worker = new TaskWorker({
        concurrency: 4,
        pollInterval: 10000,
        gracefulShutdownTimeout: 60000,
      });
      expect(worker).toBeDefined();
    });
  });

  describe("start/stop", () => {
    it("should start worker successfully", async () => {
      worker = new TaskWorker();
      await worker.start();

      expect(worker.isHealthy()).toBe(true);
      const health = worker.getHealth();
      expect(health.status).toBe("healthy");
      expect(health.isRunning).toBe(true);
      expect(health.isShuttingDown).toBe(false);
    });

    it("should stop worker successfully", async () => {
      worker = new TaskWorker();
      await worker.start();
      await worker.stop();

      expect(worker.isHealthy()).toBe(false);
      const health = worker.getHealth();
      expect(health.status).toBe("unhealthy");
      expect(health.isRunning).toBe(false);
    });

    it("should handle multiple start calls", async () => {
      worker = new TaskWorker();
      await worker.start();
      await worker.start(); // Should not throw

      expect(worker.isHealthy()).toBe(true);
    });

    it("should handle stop when not running", async () => {
      worker = new TaskWorker();
      await worker.stop(); // Should not throw

      expect(worker.isHealthy()).toBe(false);
    });
  });

  describe("task handling", () => {
    it("should handle completed tasks", async () => {
      worker = new TaskWorker();
      await worker.start();

      const mockTask = {
        id: "test-123",
        request: { instruction: "Test instruction" },
        status: TaskStatus.COMPLETED,
        priority: 0,
        addedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(Date.now() + 1000),
      };

      // Get the queue instance and simulate task completion
      const queue = (worker as any).queue;
      queue.simulateTaskComplete(mockTask);

      // Verify logging was called
      const { logger } = await import("../../../src/utils/logger");
      expect(logger.info).toHaveBeenCalledWith(
        "[Worker] Task completed",
        expect.objectContaining({
          taskId: "test-123",
          instruction: "Test instruction",
          duration: expect.any(Number),
        }),
      );
    });

    it("should handle failed tasks", async () => {
      worker = new TaskWorker();
      await worker.start();

      const mockTask = {
        id: "test-456",
        request: { instruction: "Test instruction" },
        status: TaskStatus.FAILED,
        priority: 0,
        addedAt: new Date(),
      };

      const error = new Error("Test error");

      // Get the queue instance and simulate task error
      const queue = (worker as any).queue;
      queue.simulateTaskError(mockTask, error);

      // Verify logging was called
      const { logger } = await import("../../../src/utils/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "[Worker] Task failed",
        expect.objectContaining({
          taskId: "test-456",
          instruction: "Test instruction",
          error: "Test error",
        }),
      );
    });
  });

  describe("getStats", () => {
    it("should return queue statistics", async () => {
      worker = new TaskWorker();
      await worker.start();

      const stats = worker.getStats();
      expect(stats).toEqual({
        size: 5,
        pending: 3,
        running: 2,
        completed: 10,
        failed: 1,
        isPaused: false,
      });
    });
  });

  describe("getTasks", () => {
    it("should return all tasks", async () => {
      worker = new TaskWorker();
      await worker.start();

      const tasks = worker.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe("task-1");
      expect(tasks[1].id).toBe("task-2");
    });
  });

  describe("getHealth", () => {
    it("should return health status", async () => {
      worker = new TaskWorker();
      await worker.start();

      const health = worker.getHealth();
      expect(health).toMatchObject({
        status: "healthy",
        isRunning: true,
        isShuttingDown: false,
        stats: {
          size: 5,
          pending: 3,
          running: 2,
          completed: 10,
          failed: 1,
          isPaused: false,
        },
        uptime: expect.any(Number),
        memory: expect.any(Object),
      });
    });
  });

  describe("graceful shutdown", () => {
    it("should shutdown gracefully with no running tasks", async () => {
      worker = new TaskWorker();
      await worker.start();

      // Mock queue to have no running tasks
      const queue = (worker as any).queue;
      queue.getStats = () => ({
        size: 0,
        pending: 0,
        running: 0,
        completed: 10,
        failed: 0,
        isPaused: true,
      });

      await worker.shutdown();

      expect(worker.isHealthy()).toBe(false);
      const health = worker.getHealth();
      expect(health.isShuttingDown).toBe(true);
    });

    it("should wait for tasks during shutdown", async () => {
      worker = new TaskWorker({ gracefulShutdownTimeout: 100 });
      await worker.start();

      // Mock queue to have running tasks
      const queue = (worker as any).queue;
      queue.getStats = () => ({
        size: 2,
        pending: 1,
        running: 1,
        completed: 10,
        failed: 0,
        isPaused: true,
      });

      // Mock waitForIdle to resolve after a delay
      queue.waitForIdle = () => new Promise((resolve) => setTimeout(resolve, 50));

      await worker.shutdown();

      expect(worker.isHealthy()).toBe(false);
    });

    it("should timeout during shutdown", async () => {
      worker = new TaskWorker({ gracefulShutdownTimeout: 50 });
      await worker.start();

      // Mock queue to have running tasks
      const queue = (worker as any).queue;
      queue.getStats = () => ({
        size: 2,
        pending: 1,
        running: 1,
        completed: 10,
        failed: 0,
        isPaused: true,
      });

      // Mock waitForIdle to never resolve
      queue.waitForIdle = () => new Promise(() => {});

      await worker.shutdown();

      expect(worker.isHealthy()).toBe(false);

      // Verify timeout handling
      const { logger } = await import("../../../src/utils/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "[Worker] Timeout waiting for tasks to complete",
        expect.any(Object),
      );
    });

    it("should handle multiple shutdown calls", async () => {
      worker = new TaskWorker();
      await worker.start();

      const shutdownPromise1 = worker.shutdown();
      const shutdownPromise2 = worker.shutdown();

      await Promise.all([shutdownPromise1, shutdownPromise2]);

      expect(worker.isHealthy()).toBe(false);
    });
  });
});
