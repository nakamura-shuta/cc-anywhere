import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { TaskGroupHistoryRepository } from "../../../src/repositories/task-group-history-repository.js";
import type { TaskGroup, TaskGroupResult } from "../../../src/types/task-groups.js";
import fs from "fs";
import path from "path";

describe("TaskGroupHistoryRepository", () => {
  let db: Database.Database;
  let repository: TaskGroupHistoryRepository;
  const testDbPath = path.join(process.cwd(), "test-task-groups.db");

  beforeEach(() => {
    // Create test database
    db = new Database(testDbPath);

    // Run migrations
    const migrationPath = path.join(process.cwd(), "src/db/migrations/009_add_task_groups.sql");
    const migration = fs.readFileSync(migrationPath, "utf8");
    db.exec(migration);

    repository = new TaskGroupHistoryRepository(db);
  });

  afterEach(() => {
    db.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("saveTaskGroup", () => {
    it("should save a task group with its tasks", async () => {
      const taskGroup: TaskGroup = {
        id: "test-group-1",
        name: "Test Group",
        description: "Test Description",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
            dependencies: [],
          },
          {
            id: "task-2",
            name: "Task 2",
            instruction: "Do something else",
            dependencies: ["task-1"],
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
          maxParallel: 1,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "test-group-1",
        status: "running",
        sessionId: "session-123",
        totalTasks: 2,
        completedTasks: 0,
        progress: 0,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "pending",
          },
          {
            id: "task-2",
            name: "Task 2",
            status: "pending",
          },
        ],
        startedAt: new Date(),
      };

      const saved = await repository.saveTaskGroup(taskGroup, taskGroupResult);

      expect(saved).toBeDefined();
      expect(saved.id).toBe("test-group-1");
      expect(saved.name).toBe("Test Group");
      expect(saved.description).toBe("Test Description");
      expect(saved.executionMode).toBe("sequential");
      expect(saved.sessionId).toBe("session-123");
      expect(saved.status).toBe("running");
      expect(saved.tasks).toHaveLength(2);
      expect(saved.tasks[0].id).toBe("task-1");
      expect(saved.tasks[1].id).toBe("task-2");
    });
  });

  describe("updateGroupStatus", () => {
    it("should update task group status", async () => {
      const taskGroup: TaskGroup = {
        id: "test-group-2",
        name: "Test Group 2",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "test-group-2",
        status: "running",
        totalTasks: 1,
        completedTasks: 0,
        progress: 0,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "running",
          },
        ],
        startedAt: new Date(),
      };

      await repository.saveTaskGroup(taskGroup, taskGroupResult);

      const updated = await repository.updateGroupStatus("test-group-2", "completed");

      expect(updated).toBeDefined();
      expect(updated?.status).toBe("completed");
      expect(updated?.completedAt).toBeDefined();
    });

    it("should update task group status with error", async () => {
      const taskGroup: TaskGroup = {
        id: "test-group-3",
        name: "Test Group 3",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "test-group-3",
        status: "running",
        totalTasks: 1,
        completedTasks: 0,
        progress: 0,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "running",
          },
        ],
        startedAt: new Date(),
      };

      await repository.saveTaskGroup(taskGroup, taskGroupResult);

      const updated = await repository.updateGroupStatus("test-group-3", "failed", "Test error");

      expect(updated).toBeDefined();
      expect(updated?.status).toBe("failed");
      expect(updated?.error).toBe("Test error");
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe("updateTaskStatus", () => {
    it("should update task status", async () => {
      const taskGroup: TaskGroup = {
        id: "test-group-4",
        name: "Test Group 4",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "test-group-4",
        status: "running",
        totalTasks: 1,
        completedTasks: 0,
        progress: 0,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "pending",
          },
        ],
        startedAt: new Date(),
      };

      await repository.saveTaskGroup(taskGroup, taskGroupResult);

      await repository.updateTaskStatus("task-1", "running");

      const group = await repository.findByIdWithTasks("test-group-4");
      const task = group?.tasks.find((t) => t.id === "task-1");

      expect(task).toBeDefined();
      expect(task?.status).toBe("running");
      expect(task?.startedAt).toBeDefined();
    });

    it("should update task with result and error", async () => {
      const taskGroup: TaskGroup = {
        id: "test-group-5",
        name: "Test Group 5",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "test-group-5",
        status: "running",
        totalTasks: 1,
        completedTasks: 0,
        progress: 0,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "running",
          },
        ],
        startedAt: new Date(),
      };

      await repository.saveTaskGroup(taskGroup, taskGroupResult);

      const result = { output: "Test output" };
      await repository.updateTaskStatus("task-1", "completed", result);

      const group = await repository.findByIdWithTasks("test-group-5");
      const task = group?.tasks.find((t) => t.id === "task-1");

      expect(task).toBeDefined();
      expect(task?.status).toBe("completed");
      expect(task?.result).toEqual(result);
      expect(task?.completedAt).toBeDefined();
    });
  });

  describe("updateProgress", () => {
    it("should update task group progress", async () => {
      const taskGroup: TaskGroup = {
        id: "test-group-6",
        name: "Test Group 6",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
          },
          {
            id: "task-2",
            name: "Task 2",
            instruction: "Do something else",
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "test-group-6",
        status: "running",
        totalTasks: 2,
        completedTasks: 0,
        progress: 0,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "completed",
          },
          {
            id: "task-2",
            name: "Task 2",
            status: "running",
          },
        ],
        startedAt: new Date(),
      };

      await repository.saveTaskGroup(taskGroup, taskGroupResult);

      await repository.updateProgress("test-group-6", 1, 2, "Task 2");

      const group = await repository.findById("test-group-6");

      expect(group).toBeDefined();
      expect(group?.progressCompleted).toBe(1);
      expect(group?.progressTotal).toBe(2);
      expect(group?.progressPercentage).toBe(50);
      expect(group?.currentTask).toBe("Task 2");
    });
  });

  describe("findWithFilter", () => {
    beforeEach(async () => {
      // Add test data
      const groups = [
        { id: "group-1", status: "completed", sessionId: "session-1" },
        { id: "group-2", status: "failed", sessionId: "session-1" },
        { id: "group-3", status: "completed", sessionId: "session-2" },
        { id: "group-4", status: "running", sessionId: "session-2" },
      ];

      for (const groupData of groups) {
        const taskGroup: TaskGroup = {
          id: groupData.id,
          name: `Group ${groupData.id}`,
          tasks: [
            {
              id: `${groupData.id}-task-1`,
              name: "Task 1",
              instruction: "Do something",
            },
          ],
          execution: {
            mode: "sequential",
            continueSession: true,
          },
        };

        const taskGroupResult: TaskGroupResult = {
          groupId: groupData.id,
          status: groupData.status as any,
          sessionId: groupData.sessionId,
          totalTasks: 1,
          completedTasks: groupData.status === "completed" ? 1 : 0,
          progress: groupData.status === "completed" ? 100 : 0,
          tasks: [
            {
              id: `${groupData.id}-task-1`,
              name: "Task 1",
              status: groupData.status === "completed" ? "completed" : "running",
            },
          ],
          startedAt: new Date(),
        };

        await repository.saveTaskGroup(taskGroup, taskGroupResult);
      }
    });

    it("should filter by status", async () => {
      const completed = await repository.findWithFilter({ status: "completed" });

      expect(completed).toHaveLength(2);
      expect(completed.every((g) => g.status === "completed")).toBe(true);
    });

    it("should filter by sessionId", async () => {
      const session1 = await repository.findWithFilter({ sessionId: "session-1" });

      expect(session1).toHaveLength(2);
      expect(session1.every((g) => g.sessionId === "session-1")).toBe(true);
    });

    it("should apply limit and offset", async () => {
      const page1 = await repository.findWithFilter({ limit: 2, offset: 0 });
      const page2 = await repository.findWithFilter({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe("getStatistics", () => {
    beforeEach(async () => {
      // Add test data with various statuses
      const statuses = ["completed", "completed", "failed", "running", "pending", "cancelled"];

      for (let i = 0; i < statuses.length; i++) {
        const taskGroup: TaskGroup = {
          id: `stat-group-${i}`,
          name: `Stat Group ${i}`,
          tasks: [
            {
              id: `stat-task-${i}`,
              name: "Task",
              instruction: "Do something",
            },
          ],
          execution: {
            mode: "sequential",
            continueSession: true,
          },
        };

        const taskGroupResult: TaskGroupResult = {
          groupId: `stat-group-${i}`,
          status: statuses[i] as any,
          totalTasks: 1,
          completedTasks: statuses[i] === "completed" ? 1 : 0,
          progress: statuses[i] === "completed" ? 100 : 0,
          tasks: [
            {
              id: `stat-task-${i}`,
              name: "Task",
              status: statuses[i] === "completed" ? "completed" : "pending",
            },
          ],
          startedAt: new Date(),
        };

        const saved = await repository.saveTaskGroup(taskGroup, taskGroupResult);

        // Update completed_at for completed/failed/cancelled groups
        if (["completed", "failed", "cancelled"].includes(statuses[i])) {
          await repository.updateGroupStatus(saved.id, statuses[i] as any);
        }
      }
    });

    it("should return correct statistics", async () => {
      const stats = await repository.getStatistics();

      expect(stats.total).toBe(6);
      expect(stats.pending).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);

      // Success rate should be 2 completed / (2 completed + 1 failed) = 66.67%
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe("cleanupOldHistory", () => {
    it("should delete old task groups", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

      const taskGroup: TaskGroup = {
        id: "old-group",
        name: "Old Group",
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            instruction: "Do something",
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const taskGroupResult: TaskGroupResult = {
        groupId: "old-group",
        status: "completed",
        totalTasks: 1,
        completedTasks: 1,
        progress: 100,
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: "completed",
          },
        ],
        startedAt: oldDate,
      };

      await repository.saveTaskGroup(taskGroup, taskGroupResult);

      // Manually update created_at to be old
      db.prepare("UPDATE task_groups SET created_at = ? WHERE id = ?").run(
        oldDate.toISOString(),
        "old-group",
      );

      const deletedCount = await repository.cleanupOldHistory(30);

      expect(deletedCount).toBe(1);

      const remaining = await repository.findById("old-group");
      expect(remaining).toBeNull();
    });
  });
});
