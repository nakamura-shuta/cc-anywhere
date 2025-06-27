import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskRepository } from "../../../src/db/task-repository";
import { DatabaseConnection } from "../../../src/db/database";
import { TaskStatus } from "../../../src/claude/types";
import type { TaskFilter, PaginationOptions } from "../../../src/db/types";

describe("TaskRepository", () => {
  // Use in-memory database for tests
  const testDbPath = ":memory:";
  let repository: TaskRepository;

  beforeEach(() => {
    // Reset singleton instance
    const instance = (DatabaseConnection as any).instance;
    if (instance) {
      instance.close();
      (DatabaseConnection as any).instance = undefined;
    }

    // Create repository with in-memory database
    repository = new TaskRepository(testDbPath);
  });

  afterEach(() => {
    // Clean up
    const instance = (DatabaseConnection as any).instance;
    if (instance) {
      instance.close();
      (DatabaseConnection as any).instance = undefined;
    }
  });

  describe("create", () => {
    it("should create a new task", () => {
      const task = repository.create({
        id: "test-1",
        instruction: "Test task",
        priority: 5,
      });

      expect(task.id).toBe("test-1");
      expect(task.instruction).toBe("Test task");
      expect(task.priority).toBe(5);
      expect(task.status).toBe("pending");
      expect(task.created_at).toBeDefined();
    });

    it("should create task with context and options", () => {
      const task = repository.create({
        id: "test-2",
        instruction: "Test task with context",
        context: { workingDirectory: "/test" },
        options: { timeout: 5000, allowedTools: ["Read"] },
      });

      expect(task.context).toBe('{"workingDirectory":"/test"}');
      expect(task.options).toBe('{"timeout":5000,"allowedTools":["Read"]}');
    });
  });

  describe("getById", () => {
    it("should retrieve task by ID", () => {
      repository.create({
        id: "test-get",
        instruction: "Get test",
      });

      const task = repository.getById("test-get");
      expect(task).toBeDefined();
      expect(task?.id).toBe("test-get");
      expect(task?.instruction).toBe("Get test");
    });

    it("should return undefined for non-existent task", () => {
      const task = repository.getById("non-existent");
      expect(task).toBeUndefined();
    });
  });

  describe("updateStatus", () => {
    it("should update task status to running", () => {
      repository.create({
        id: "test-status",
        instruction: "Status test",
      });

      repository.updateStatus("test-status", TaskStatus.RUNNING);

      const task = repository.getById("test-status");
      expect(task?.status).toBe("running");
      expect(task?.started_at).toBeDefined();
    });

    it("should update task status to completed", () => {
      repository.create({
        id: "test-complete",
        instruction: "Complete test",
      });

      repository.updateStatus("test-complete", TaskStatus.COMPLETED);

      const task = repository.getById("test-complete");
      expect(task?.status).toBe("completed");
      expect(task?.completed_at).toBeDefined();
    });

    it("should update task status to failed with error", () => {
      repository.create({
        id: "test-fail",
        instruction: "Fail test",
      });

      const error = new Error("Test error");
      repository.updateStatus("test-fail", TaskStatus.FAILED, error);

      const task = repository.getById("test-fail");
      expect(task?.status).toBe("failed");
      expect(task?.completed_at).toBeDefined();
      expect(task?.error).toContain("Test error");
    });
  });

  describe("updateResult", () => {
    it("should update task result", () => {
      repository.create({
        id: "test-result",
        instruction: "Result test",
      });

      const result = {
        taskId: "test-result",
        status: TaskStatus.COMPLETED,
        instruction: "Result test",
        result: "Task completed successfully",
        createdAt: new Date(),
        completedAt: new Date(),
      };

      repository.updateResult("test-result", result);

      const task = repository.getById("test-result");
      expect(task?.status).toBe("completed");
      expect(task?.result).toBeDefined();
      expect(JSON.parse(task?.result || "{}").result).toBe("Task completed successfully");
    });
  });

  describe("find", () => {
    it("should find all tasks with pagination", () => {
      // Create test tasks
      repository.create({
        id: "find-all-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "find-all-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "find-all-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const result = repository.find({}, { limit: 10, offset: 0 });

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it("should filter by status", () => {
      repository.create({
        id: "status-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "status-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "status-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const filter: TaskFilter = { status: TaskStatus.PENDING };
      const result = repository.find(filter, { limit: 10, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.data[0].instruction).toBe("Second task");
    });

    it("should filter by multiple statuses", () => {
      repository.create({
        id: "multi-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "multi-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "multi-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const filter: TaskFilter = {
        status: [TaskStatus.PENDING, TaskStatus.RUNNING],
      };
      const result = repository.find(filter, { limit: 10, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.data.map((t) => t.instruction)).toContain("Second task");
      expect(result.data.map((t) => t.instruction)).toContain("Third task");
    });

    it("should filter by priority", () => {
      repository.create({
        id: "priority-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "priority-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "priority-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const filter: TaskFilter = { priority: 10 };
      const result = repository.find(filter, { limit: 10, offset: 0 });

      expect(result.total).toBe(2); // task-1 and task-3 have priority >= 10
    });

    it("should search by instruction", () => {
      repository.create({
        id: "search-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "search-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "search-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const filter: TaskFilter = { search: "Second" };
      const result = repository.find(filter, { limit: 10, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.data[0].instruction).toBe("Second task");
    });

    it("should handle pagination", () => {
      repository.create({
        id: "page-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "page-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "page-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const result1 = repository.find({}, { limit: 2, offset: 0 });
      expect(result1.data).toHaveLength(2);
      expect(result1.hasNext).toBe(true);
      expect(result1.hasPrev).toBe(false);

      const result2 = repository.find({}, { limit: 2, offset: 2 });
      expect(result2.data).toHaveLength(1);
      expect(result2.hasNext).toBe(false);
      expect(result2.hasPrev).toBe(true);
    });

    it("should order by priority descending", () => {
      repository.create({
        id: "order-1",
        instruction: "First task",
        priority: 10,
        status: TaskStatus.COMPLETED,
      });
      repository.create({
        id: "order-2",
        instruction: "Second task",
        priority: 5,
        status: TaskStatus.PENDING,
      });
      repository.create({
        id: "order-3",
        instruction: "Third task",
        priority: 15,
        status: TaskStatus.RUNNING,
      });

      const pagination: PaginationOptions = {
        limit: 10,
        offset: 0,
        orderBy: "priority",
        orderDirection: "DESC",
      };
      const result = repository.find({}, pagination);

      expect(result.data[0].priority).toBe(15);
      expect(result.data[1].priority).toBe(10);
      expect(result.data[2].priority).toBe(5);
    });
  });

  describe("getPendingTasks", () => {
    it("should retrieve pending and running tasks", () => {
      repository.create({
        id: "pending-1",
        instruction: "Pending task",
        status: TaskStatus.PENDING,
        priority: 5,
      });
      repository.create({
        id: "running-1",
        instruction: "Running task",
        status: TaskStatus.RUNNING,
        priority: 10,
      });
      repository.create({
        id: "completed-1",
        instruction: "Completed task",
        status: TaskStatus.COMPLETED,
      });

      const pendingTasks = repository.getPendingTasks();

      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks[0].id).toBe("running-1"); // Higher priority
      expect(pendingTasks[1].id).toBe("pending-1");
    });
  });

  describe("cleanupOldTasks", () => {
    it("should delete old completed tasks", () => {
      // Create an old completed task
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      repository.create({
        id: "old-task",
        instruction: "Old task",
        status: TaskStatus.COMPLETED,
      });

      // Manually update the completed_at date
      const db = (repository as any).db.getDb();
      db.prepare("UPDATE tasks SET completed_at = ? WHERE id = ?").run(
        oldDate.toISOString(),
        "old-task",
      );

      // Create a recent task
      repository.create({
        id: "recent-task",
        instruction: "Recent task",
        status: TaskStatus.COMPLETED,
      });

      const deletedCount = repository.cleanupOldTasks(30);

      expect(deletedCount).toBe(1);
      expect(repository.getById("old-task")).toBeUndefined();
      expect(repository.getById("recent-task")).toBeDefined();
    });
  });

  describe("toQueuedTask", () => {
    it("should convert database record to QueuedTask", () => {
      const task = repository.create({
        id: "convert-test",
        instruction: "Convert test",
        context: { workingDirectory: "/test" },
        options: { timeout: 5000 },
        priority: 7,
      });

      const queuedTask = repository.toQueuedTask(task);

      expect(queuedTask.id).toBe("convert-test");
      expect(queuedTask.request.instruction).toBe("Convert test");
      expect(queuedTask.request.context?.workingDirectory).toBe("/test");
      expect(queuedTask.request.options?.timeout).toBe(5000);
      expect(queuedTask.priority).toBe(7);
      expect(queuedTask.status).toBe("pending");
      expect(queuedTask.addedAt).toBeInstanceOf(Date);
    });
  });
});
