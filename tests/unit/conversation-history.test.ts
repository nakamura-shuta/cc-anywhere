import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskExecutorImpl } from "../../src/claude/executor";
import { TaskQueueImpl } from "../../src/queue/task-queue";
import { TaskStatus, type TaskRequest } from "../../src/claude/types";
import { getSharedDbProvider, closeSharedServices } from "../../src/db/shared-instance";

describe("Conversation History", () => {
  // let executor: TaskExecutorImpl;
  let queue: TaskQueueImpl;

  beforeEach(async () => {
    // Initialize database
    const dbProvider = getSharedDbProvider();

    // Run migration to add conversation_history column
    const db = dbProvider.getDb();
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN conversation_history TEXT");
    } catch (error) {
      // Column might already exist
    }

    executor = new TaskExecutorImpl();
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
      context: { workingDirectory: "/test" },
    };

    // Add task to queue
    const taskId = queue.add(task);

    // Get task from queue
    const queuedTask = queue.get(taskId);
    expect(queuedTask).toBeDefined();

    // Execute task directly (bypass queue processing)
    await queue["executeTask"](queuedTask!);

    // Check that conversation history was saved
    const repository = queue["repository"];
    const savedTask = repository.getById(taskId);

    expect(savedTask).toBeDefined();
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
      context: { workingDirectory: "/test" },
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
      context: { workingDirectory: "/test" },
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
