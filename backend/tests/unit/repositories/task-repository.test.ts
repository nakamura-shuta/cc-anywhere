import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { TaskRepositoryImpl } from "../../../src/repositories/task-repository";
import type { TaskEntity } from "../../../src/repositories/types";
import { TaskStatus } from "../../../src/claude/types";

describe("TaskRepositoryImpl", () => {
  let db: Database.Database;
  let repository: TaskRepositoryImpl;

  beforeEach(() => {
    db = new Database(":memory:");
    repository = new TaskRepositoryImpl(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("create", () => {
    it("should create a task entity", async () => {
      const task: TaskEntity = {
        id: "test-id",
        instruction: "Test instruction",
        context: { test: true },
        options: { timeout: 1000 },
        priority: 1,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await repository.create(task);
      expect(created).toEqual(task);

      const found = await repository.findById("test-id");
      expect(found).toBeTruthy();
      expect(found?.id).toBe("test-id");
      expect(found?.instruction).toBe("Test instruction");
    });
  });

  describe("findByStatus", () => {
    it("should find tasks by status", async () => {
      const task1: TaskEntity = {
        id: "task-1",
        instruction: "Task 1",
        priority: 1,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: TaskEntity = {
        id: "task-2",
        instruction: "Task 2",
        priority: 2,
        status: TaskStatus.RUNNING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(task1);
      await repository.create(task2);

      const pending = await repository.findByStatus(TaskStatus.PENDING);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe("task-1");

      const running = await repository.findByStatus(TaskStatus.RUNNING);
      expect(running).toHaveLength(1);
      expect(running[0].id).toBe("task-2");
    });
  });

  describe("updateStatus", () => {
    it("should update task status and set timestamps", async () => {
      const task: TaskEntity = {
        id: "test-id",
        instruction: "Test",
        priority: 0,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(task);

      // Update to running
      await repository.updateStatus("test-id", TaskStatus.RUNNING);
      let updated = await repository.findById("test-id");
      expect(updated?.status).toBe(TaskStatus.RUNNING);
      expect(updated?.startedAt).toBeTruthy();

      // Update to completed
      await repository.updateStatus("test-id", TaskStatus.COMPLETED);
      updated = await repository.findById("test-id");
      expect(updated?.status).toBe(TaskStatus.COMPLETED);
      expect(updated?.completedAt).toBeTruthy();
    });

    it("should store error information when failing", async () => {
      const task: TaskEntity = {
        id: "test-id",
        instruction: "Test",
        priority: 0,
        status: TaskStatus.RUNNING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(task);

      const error = new Error("Test error");
      await repository.updateStatus("test-id", TaskStatus.FAILED, error);

      const updated = await repository.findById("test-id");
      expect(updated?.status).toBe(TaskStatus.FAILED);
      expect(updated?.error).toBeTruthy();
      expect((updated?.error as any).message).toBe("Test error");
    });
  });

  describe("findPendingTasks", () => {
    it("should return pending and running tasks ordered by priority", async () => {
      const tasks: TaskEntity[] = [
        {
          id: "low-priority",
          instruction: "Low priority",
          priority: 1,
          status: TaskStatus.PENDING,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date(),
        },
        {
          id: "high-priority",
          instruction: "High priority",
          priority: 10,
          status: TaskStatus.PENDING,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date(),
        },
        {
          id: "running",
          instruction: "Running",
          priority: 5,
          status: TaskStatus.RUNNING,
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date(),
        },
        {
          id: "completed",
          instruction: "Completed",
          priority: 20,
          status: TaskStatus.COMPLETED,
          createdAt: new Date("2024-01-04"),
          updatedAt: new Date(),
        },
      ];

      for (const task of tasks) {
        await repository.create(task);
      }

      const pending = await repository.findPendingTasks();
      expect(pending).toHaveLength(3); // PENDING + RUNNING
      expect(pending[0].id).toBe("high-priority"); // Highest priority first
      expect(pending[1].id).toBe("running");
      expect(pending[2].id).toBe("low-priority");
    });
  });

  describe("pagination", () => {
    it("should support pagination", async () => {
      // Create 10 tasks
      for (let i = 0; i < 10; i++) {
        await repository.create({
          id: `task-${i}`,
          instruction: `Task ${i}`,
          priority: i,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const page1 = await repository.findMany([], { page: 1, limit: 5 });
      expect(page1.items).toHaveLength(5);
      expect(page1.total).toBe(10);
      expect(page1.totalPages).toBe(2);

      const page2 = await repository.findMany([], { page: 2, limit: 5 });
      expect(page2.items).toHaveLength(5);
      expect(page2.items[0].id).not.toBe(page1.items[0].id);
    });
  });

  describe("filtering", () => {
    it("should support various filter operators", async () => {
      const tasks: TaskEntity[] = [
        {
          id: "task-1",
          instruction: "First task",
          priority: 1,
          status: TaskStatus.PENDING,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date(),
        },
        {
          id: "task-2",
          instruction: "Second task",
          priority: 5,
          status: TaskStatus.RUNNING,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date(),
        },
        {
          id: "task-3",
          instruction: "Third task",
          priority: 10,
          status: TaskStatus.COMPLETED,
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date(),
        },
      ];

      for (const task of tasks) {
        await repository.create(task);
      }

      // Equal filter
      const running = await repository.findMany([
        { field: "status", operator: "eq", value: TaskStatus.RUNNING },
      ]);
      expect(running.items).toHaveLength(1);
      expect(running.items[0].id).toBe("task-2");

      // Greater than filter
      const highPriority = await repository.findMany([
        { field: "priority", operator: "gt", value: 5 },
      ]);
      expect(highPriority.items).toHaveLength(1);
      expect(highPriority.items[0].id).toBe("task-3");

      // Like filter
      const secondTasks = await repository.findMany([
        { field: "instruction", operator: "like", value: "%Second%" },
      ]);
      expect(secondTasks.items).toHaveLength(1);
      expect(secondTasks.items[0].id).toBe("task-2");
    });
  });
});
