import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskQueueImpl } from "../../../src/queue/task-queue";
import type { TaskRequest } from "../../../src/claude/types";
import { getTypedEventBus } from "../../../src/events";

// Mock the TaskExecutorImpl
vi.mock("../../../src/claude/executor", () => ({
  TaskExecutorImpl: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: "Task completed",
      logs: [],
      duration: 100,
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("TaskQueue Event Emissions", () => {
  let queue: TaskQueueImpl;
  let eventBus: ReturnType<typeof getTypedEventBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new TaskQueueImpl({ concurrency: 1 });
    eventBus = getTypedEventBus();
  });

  it("should emit task.created event when task is added", async () => {
    const handler = vi.fn();
    eventBus.on("task.created", handler);

    const request: TaskRequest = {
      instruction: "Test task",
      context: {},
      options: {},
    };

    const taskId = queue.add(request, 1);

    // Wait a bit for async event emission
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        request,
        priority: 1,
        createdAt: expect.any(Date),
      }),
      expect.objectContaining({
        type: "task.created",
        id: expect.any(String),
        timestamp: expect.any(Date),
        payload: expect.objectContaining({
          taskId,
          request,
          priority: 1,
          createdAt: expect.any(Date),
        }),
      }),
    );
  });

  it("should emit task.started event when task execution begins", async () => {
    const handler = vi.fn();
    eventBus.on("task.started", handler);

    const request: TaskRequest = {
      instruction: "Test task",
      context: {},
      options: {},
    };

    const taskId = queue.add(request);

    // Wait for task to start
    await queue.waitForIdle();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        startedAt: expect.any(Date),
      }),
      expect.objectContaining({
        type: "task.started",
        payload: expect.objectContaining({
          taskId,
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("should emit task.completed event when task succeeds", async () => {
    const handler = vi.fn();
    eventBus.on("task.completed", handler);

    const request: TaskRequest = {
      instruction: "Test task",
      context: {},
      options: {},
    };

    const taskId = queue.add(request);

    // Wait for task to complete
    await queue.waitForIdle();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        result: "Task completed",
        duration: expect.any(Number),
        completedAt: expect.any(Date),
      }),
      expect.objectContaining({
        type: "task.completed",
        payload: expect.objectContaining({
          taskId,
          result: "Task completed",
          duration: expect.any(Number),
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("should emit task.failed event when task fails", async () => {
    // Mock executor to fail
    const { TaskExecutorImpl } = await import("../../../src/claude/executor");
    (TaskExecutorImpl as any).mockImplementation(() => ({
      execute: vi.fn().mockResolvedValue({
        success: false,
        error: new Error("Task failed"),
        logs: [],
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
    }));

    const newQueue = new TaskQueueImpl({ concurrency: 1 });
    const handler = vi.fn();
    eventBus.on("task.failed", handler);

    const request: TaskRequest = {
      instruction: "Test task",
      context: {},
      options: {},
    };

    const taskId = newQueue.add(request);

    // Wait for task to fail
    await newQueue.waitForIdle();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        error: expect.objectContaining({
          message: "Task failed",
          code: "EXECUTION_ERROR",
        }),
        failedAt: expect.any(Date),
        willRetry: false,
      }),
      expect.objectContaining({
        type: "task.failed",
        payload: expect.objectContaining({
          taskId,
          error: expect.objectContaining({
            message: "Task failed",
            code: "EXECUTION_ERROR",
          }),
          failedAt: expect.any(Date),
          willRetry: false,
        }),
      }),
    );
  });

  it("should emit task.cancelled event when task is cancelled", async () => {
    const handler = vi.fn();
    eventBus.on("task.cancelled", handler);

    const request: TaskRequest = {
      instruction: "Test task",
      context: {},
      options: {},
    };

    const taskId = queue.add(request);

    // Cancel immediately
    await queue.cancelTask(taskId);

    // Wait a bit for async event emission
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        reason: "Cancelled via API",
        cancelledAt: expect.any(Date),
      }),
      expect.objectContaining({
        type: "task.cancelled",
        payload: expect.objectContaining({
          taskId,
          reason: "Cancelled via API",
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });
});
