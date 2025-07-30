import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskExecutorImpl } from "../../src/claude/executor";
import { TaskQueueImpl } from "../../src/queue/task-queue";
import { TaskStatus } from "../../src/claude/types";
import type { TaskRequest } from "../../src/claude/types";

// Mock the shared instance
vi.mock("../../src/claude/shared-instance", () => ({
  getSharedClaudeClient: vi.fn().mockReturnValue({
    executeTask: vi.fn().mockImplementation(async (prompt, options) => {
      // Simulate a long-running task that checks abort signal
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (options.abortController?.signal.aborted) {
            clearInterval(checkInterval);
            const abortError = new Error("Task aborted");
            abortError.name = "AbortError";
            reject(abortError);
          }
        }, 100);

        // Simulate task completion after 2 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve({
            messages: [
              {
                type: "assistant",
                message: { content: [{ type: "text", text: "Task completed" }] },
              },
            ],
            success: true,
          });
        }, 2000);
      });
    }),
    formatMessagesAsString: vi.fn().mockReturnValue("Task completed"),
    getCurrentMode: vi.fn().mockReturnValue("api-key"),
    getModelName: vi.fn().mockReturnValue("claude-3-opus-20240229"),
  }),
}));

// Mock the logger
vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the config
vi.mock("../../src/config", () => ({
  config: {
    claude: { apiKey: "test-key" },
    tasks: { defaultTimeout: 300000 },
    database: { path: ":memory:" },
    queue: { concurrency: 1 },
    claudeCodeSDK: { defaultMaxTurns: 3 },
  },
}));

describe("Task Cancellation", () => {
  let executor: TaskExecutorImpl;
  let queue: TaskQueueImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new TaskExecutorImpl();
    queue = new TaskQueueImpl({ autoStart: false });
  });

  describe("TaskExecutorImpl", () => {
    it("should cancel a running task", async () => {
      const taskId = "test-task-123";
      const request: TaskRequest = {
        instruction: "Long running task",
        options: { timeout: 10000 },
      };

      // Start the task execution
      const executePromise = executor.execute(request, taskId);

      // Wait a bit for the task to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Cancel the task
      await executor.cancel(taskId);

      // The execution should fail with cancellation error
      const result = await executePromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Task was cancelled");
    });

    it("should handle cancellation of non-existent task", async () => {
      // Should not throw, just log a warning
      await expect(executor.cancel("non-existent-task")).resolves.toBeUndefined();
    });
  });

  describe("TaskQueueImpl", () => {
    it("should cancel a pending task", async () => {
      const request: TaskRequest = {
        instruction: "Test task",
      };

      // Add task to queue but don't start it
      const taskId = queue.add(request);

      // Cancel the task
      const cancelled = await queue.cancelTask(taskId);
      expect(cancelled).toBe(true);

      // Verify task status
      const task = queue.get(taskId);
      expect(task?.status).toBe(TaskStatus.CANCELLED);
      expect(task?.completedAt).toBeDefined();
    });

    it("should cancel a running task", async () => {
      // Create a mock executor that simulates a long running task
      const mockExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          // Simulate long running task
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 5000);
            // Store timer for cancellation
            (mockExecutor as any).timer = timer;
            (mockExecutor as any).reject = reject;
          });
          return {
            success: true,
            output: "Done",
            logs: [],
            duration: 5000,
          };
        }),
        cancel: vi.fn().mockImplementation(async () => {
          // Clear the timer and reject with cancellation error
          if ((mockExecutor as any).timer) {
            clearTimeout((mockExecutor as any).timer);
          }
          if ((mockExecutor as any).reject) {
            (mockExecutor as any).reject(new Error("Task was cancelled"));
          }
        }),
      };

      // Create queue and replace executor
      const testQueue = new TaskQueueImpl({ autoStart: false });
      (testQueue as any).executor = mockExecutor;

      const request: TaskRequest = {
        instruction: "Long running task",
        options: { timeout: 30000 },
      };

      // Start the queue
      testQueue.start();

      // Add task to queue
      const taskId = testQueue.add(request);

      // Wait for task to start running
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify task is running
      let task = testQueue.get(taskId);
      expect(task?.status).toBe(TaskStatus.RUNNING);

      // Cancel the task
      const cancelled = await testQueue.cancelTask(taskId);
      expect(cancelled).toBe(true);

      // Wait for cancellation to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify task status
      task = testQueue.get(taskId);
      expect(task?.status).toBe(TaskStatus.CANCELLED);
    });

    it("should not cancel completed task", async () => {
      // Create a simple mock executor for quick completion
      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "Done",
          logs: [],
          duration: 100,
        }),
        cancel: vi.fn(),
      };

      // Use reflection to replace the executor
      const testQueue = new TaskQueueImpl({ autoStart: false });
      (testQueue as any).executor = mockExecutor;

      const request: TaskRequest = {
        instruction: "Quick task",
      };

      // Add and execute task
      const taskId = testQueue.add(request);
      testQueue.start();

      // Wait for completion
      await testQueue.waitForIdle();

      // Try to cancel completed task
      const cancelled = await testQueue.cancelTask(taskId);
      expect(cancelled).toBe(false);

      // Verify task remains completed
      const task = testQueue.get(taskId);
      expect(task?.status).toBe(TaskStatus.COMPLETED);
    });

    it("should handle cancellation of non-existent task", async () => {
      const cancelled = await queue.cancelTask("non-existent-task");
      expect(cancelled).toBe(false);
    });
  });
});
