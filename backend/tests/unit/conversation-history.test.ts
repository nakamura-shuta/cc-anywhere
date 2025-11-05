import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskQueueImpl } from "../../src/queue/task-queue";
import { TaskStatus, type TaskRequest } from "../../src/claude/types";
import { getSharedDbProvider, closeSharedServices } from "../../src/db/shared-instance";

describe("Conversation History", () => {
  let queue: TaskQueueImpl;

  beforeEach(async () => {
    // Initialize database
    getSharedDbProvider();

    // Database migrations are handled by DatabaseProvider automatically
    // No need to manually add conversation_history column here

    queue = new TaskQueueImpl({ concurrency: 1, autoStart: false });
  });

  afterEach(async () => {
    closeSharedServices();
  });

  it("should save conversation history when task completes", async () => {
    // Mock the Claude Code SDK response
    const mockMessages = [
      { type: "user", content: "Test instruction" },
      { type: "assistant", content: "Test response" },
    ];

    // Mock the executor on the queue instance
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: "Test output",
        logs: ["Test log"],
        duration: 1000,
        conversationHistory: mockMessages,
      }),
      cancel: vi.fn(),
    };

    // Replace the queue's executor
    queue["executor"] = mockExecutor;

    const task: TaskRequest = {
      instruction: "Test instruction",
      // Don't specify workingDirectory to avoid path validation
    };

    // Add task to queue
    const taskId = queue.add(task);

    // Get task from queue
    const queuedTask = queue.get(taskId);
    expect(queuedTask).toBeDefined();

    // Execute task directly (bypass queue processing)
    try {
      await queue["executeTask"](queuedTask!);
    } catch (error) {
      console.error("Error executing task:", error);
      throw error;
    }

    // Check that conversation history was saved
    const repository = queue["repository"];
    const savedTask = repository.getById(taskId);

    // Debug: Check database directly
    const dbProvider = getSharedDbProvider();
    const db = dbProvider.getDb();
    const rawRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;

    expect(savedTask).toBeDefined();
    expect(mockExecutor.execute.mock.calls.length).toBeGreaterThan(0);
    expect(rawRow?.conversation_history).toBeDefined();
    expect(savedTask?.conversationHistory).toEqual(mockMessages);
  });

  it("should not save conversation history if not available", async () => {
    // Mock the executor without conversation history
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: "Test output",
        logs: ["Test log"],
        duration: 1000,
        // No conversationHistory field
      }),
      cancel: vi.fn(),
    };

    // Replace the queue's executor
    queue["executor"] = mockExecutor;

    const task: TaskRequest = {
      instruction: "Test instruction",
      // Don't specify workingDirectory to avoid path validation
    };

    // Add task to queue
    const taskId = queue.add(task);

    // Get task from queue
    const queuedTask = queue.get(taskId);
    expect(queuedTask).toBeDefined();

    // Execute task directly
    await queue["executeTask"](queuedTask!);

    // Check that conversation history was not saved
    const repository = queue["repository"];
    const savedTask = repository.getById(taskId);

    expect(savedTask).toBeDefined();
    expect(savedTask?.conversationHistory).toBeUndefined();
  });

  it("should include conversation history in failed tasks", async () => {
    const mockMessages = [
      { type: "user", content: "Test instruction" },
      { type: "assistant", content: "Error occurred" },
    ];

    // Mock the executor to fail with conversation history
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: false,
        error: new Error("Test error"),
        logs: ["Test log", "Error log"],
        duration: 1000,
        conversationHistory: mockMessages,
      }),
      cancel: vi.fn(),
    };

    // Replace the queue's executor
    queue["executor"] = mockExecutor;

    const task: TaskRequest = {
      instruction: "Test instruction that fails",
      // Don't specify workingDirectory to avoid path validation
    };

    // Add task to queue
    const taskId = queue.add(task);

    // Get task from queue
    const queuedTask = queue.get(taskId);
    expect(queuedTask).toBeDefined();

    // Execute task directly
    await queue["executeTask"](queuedTask!);

    // Check that conversation history was saved even for failed task
    const repository = queue["repository"];
    const savedTask = repository.getById(taskId);

    expect(savedTask).toBeDefined();
    expect(savedTask?.status).toBe(TaskStatus.FAILED);
    expect(savedTask?.conversationHistory).toEqual(mockMessages);
  });
});
