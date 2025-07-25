import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { TaskRepositoryAdapter } from "../../../src/repositories/task-repository-adapter";
import { TaskStatus } from "../../../src/claude/types";
import { v4 as uuidv4 } from "uuid";

describe("TaskRepositoryAdapter SDK Session", () => {
  let db: Database.Database;
  let repository: TaskRepositoryAdapter;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(":memory:");

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        instruction TEXT NOT NULL,
        context TEXT,
        options TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        result TEXT,
        error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        started_at TEXT,
        cancelled_at TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 0,
        retry_metadata TEXT,
        group_id TEXT,
        repository_name TEXT,
        conversation_history TEXT,
        continued_from TEXT,
        sdk_session_id TEXT,
        progress_data TEXT,
        UNIQUE(id)
      )
    `);

    repository = new TaskRepositoryAdapter(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should save and retrieve SDK session ID", () => {
    const taskId = uuidv4();
    const sdkSessionId = "test-session-123";

    // Create a task
    const task = repository.create({
      id: taskId,
      instruction: "Test task",
      priority: 0,
      status: TaskStatus.PENDING,
    });

    expect(task.sdkSessionId).toBeUndefined();

    // Update SDK session ID
    repository.updateSdkSessionId(taskId, sdkSessionId);

    // Retrieve the task
    const updatedTask = repository.getById(taskId);
    expect(updatedTask).toBeDefined();
    expect(updatedTask!.sdkSessionId).toBe(sdkSessionId);
  });

  it("should handle tasks without SDK session ID", () => {
    const taskId = uuidv4();

    // Create a task without SDK session ID
    const task = repository.create({
      id: taskId,
      instruction: "Test task without session",
      priority: 0,
      status: TaskStatus.PENDING,
    });

    expect(task.sdkSessionId).toBeUndefined();

    // Retrieve the task
    const retrievedTask = repository.getById(taskId);
    expect(retrievedTask).toBeDefined();
    expect(retrievedTask!.sdkSessionId).toBeUndefined();
  });

  it("should update SDK session ID for existing task", () => {
    const taskId = uuidv4();
    const oldSessionId = "old-session-123";
    const newSessionId = "new-session-456";

    // Create a task
    repository.create({
      id: taskId,
      instruction: "Test task",
      priority: 0,
      status: TaskStatus.PENDING,
    });

    // Update with first session ID
    repository.updateSdkSessionId(taskId, oldSessionId);
    let task = repository.getById(taskId);
    expect(task!.sdkSessionId).toBe(oldSessionId);

    // Update with new session ID
    repository.updateSdkSessionId(taskId, newSessionId);
    task = repository.getById(taskId);
    expect(task!.sdkSessionId).toBe(newSessionId);
  });

  it("should persist SDK session ID across different queries", () => {
    const taskId = uuidv4();
    const sdkSessionId = "persistent-session-789";

    // Create and update task
    repository.create({
      id: taskId,
      instruction: "Test persistence",
      priority: 0,
      status: TaskStatus.PENDING,
    });
    repository.updateSdkSessionId(taskId, sdkSessionId);

    // Test through find method
    const foundTasks = repository.find({ status: TaskStatus.PENDING });
    const foundTask = foundTasks.data.find((t) => t.id === taskId);
    expect(foundTask).toBeDefined();
    expect(foundTask!.sdkSessionId).toBe(sdkSessionId);

    // Test through getPendingTasks
    const pendingTasks = repository.getPendingTasks();
    const pendingTask = pendingTasks.find((t) => t.id === taskId);
    expect(pendingTask).toBeDefined();
    expect(pendingTask!.request.options?.sdk?.resumeSession).toBeUndefined(); // SDK session ID is not part of the request
  });

  it("should handle SDK session ID with special characters", () => {
    const taskId = uuidv4();
    const sdkSessionId = "session-with-special-chars_123!@#$%^&*()";

    repository.create({
      id: taskId,
      instruction: "Test special chars",
      priority: 0,
      status: TaskStatus.PENDING,
    });

    repository.updateSdkSessionId(taskId, sdkSessionId);

    const task = repository.getById(taskId);
    expect(task!.sdkSessionId).toBe(sdkSessionId);
  });
});
