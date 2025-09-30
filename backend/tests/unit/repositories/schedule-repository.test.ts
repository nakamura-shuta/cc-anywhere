import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { ScheduleRepository } from "../../../src/repositories/schedule-repository.js";
import type {
  ScheduledTask,
  ScheduleSessionState,
  PersistentScheduledTaskHistory,
  ScheduleFilter,
} from "../../../src/types/scheduled-task.js";
import type { TaskRequest } from "../../../src/claude/types.js";

describe("ScheduleRepository", () => {
  let db: Database.Database;
  let repository: ScheduleRepository;

  beforeEach(() => {
    // メモリ内データベースを使用
    db = new Database(":memory:");

    // マイグレーション適用
    const migrationSql = `
      CREATE TABLE schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        task_request TEXT NOT NULL,
        schedule_type TEXT NOT NULL CHECK(schedule_type IN ('cron', 'once')),
        cron_expression TEXT,
        execute_at DATETIME,
        timezone TEXT DEFAULT 'Asia/Tokyo',
        status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'completed', 'failed')),
        metadata TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE schedule_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id TEXT NOT NULL,
        executed_at DATETIME NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
      );

      CREATE TABLE schedule_session_state (
        schedule_id TEXT PRIMARY KEY,
        execution_count INTEGER DEFAULT 0,
        last_session_reset DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
      );
    `;

    db.exec(migrationSql);
    repository = new ScheduleRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  const createTestSchedule = (): ScheduledTask => ({
    id: "test-schedule-1",
    name: "Test Schedule",
    description: "A test schedule",
    taskRequest: {
      instruction: "Run test",
    } as TaskRequest,
    schedule: {
      type: "cron",
      expression: "0 0 * * *",
      timezone: "Asia/Tokyo",
    },
    status: "active",
    metadata: {
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      executionCount: 0,
    },
    history: [],
  });

  describe("基本CRUD操作", () => {
    it("should create a schedule", async () => {
      const schedule = createTestSchedule();
      const created = await repository.create(schedule);

      expect(created.id).toBe(schedule.id);
      expect(created.name).toBe(schedule.name);
      expect(created.status).toBe("active");
    });

    it("should find schedule by id", async () => {
      const schedule = createTestSchedule();
      await repository.create(schedule);

      const found = await repository.findById("test-schedule-1");

      expect(found).not.toBeNull();
      expect(found?.id).toBe("test-schedule-1");
      expect(found?.name).toBe("Test Schedule");
    });

    it("should update schedule", async () => {
      const schedule = createTestSchedule();
      await repository.create(schedule);

      const updated = { ...schedule, name: "Updated Schedule", status: "inactive" as const };
      await repository.update("test-schedule-1", updated);

      const found = await repository.findById("test-schedule-1");
      expect(found?.name).toBe("Updated Schedule");
      expect(found?.status).toBe("inactive");
    });

    it("should delete schedule", async () => {
      const schedule = createTestSchedule();
      await repository.create(schedule);

      await repository.delete("test-schedule-1");

      const found = await repository.findById("test-schedule-1");
      expect(found).toBeNull();
    });
  });

  describe("フィルター検索", () => {
    beforeEach(async () => {
      const schedules = [
        { ...createTestSchedule(), id: "active-1", status: "active" as const },
        { ...createTestSchedule(), id: "inactive-1", status: "inactive" as const },
        {
          ...createTestSchedule(),
          id: "once-1",
          schedule: { type: "once" as const, executeAt: new Date() },
        },
      ];

      for (const schedule of schedules) {
        await repository.create(schedule);
      }
    });

    it("should filter by status", async () => {
      const filter: ScheduleFilter = { status: "active" };
      const results = await repository.findWithFilter(filter);

      expect(results.length).toBe(2); // active-1 and once-1 (default active)
      results.forEach((result) => expect(result.status).toBe("active"));
    });

    it("should filter by schedule type", async () => {
      const filter: ScheduleFilter = { scheduleType: "once" };
      const results = await repository.findWithFilter(filter);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("once-1");
    });

    it("should apply pagination", async () => {
      const filter: ScheduleFilter = { limit: 1, offset: 0 };
      const results = await repository.findWithFilter(filter);

      expect(results.length).toBe(1);
    });
  });

  describe("履歴管理", () => {
    beforeEach(async () => {
      const schedule = createTestSchedule();
      await repository.create(schedule);
    });

    it("should add history entry", async () => {
      const historyEntry: Omit<PersistentScheduledTaskHistory, "id" | "createdAt"> = {
        scheduleId: "test-schedule-1",
        executedAt: new Date("2025-01-01T10:00:00Z"),
        taskId: "task-123",
        status: "success",
      };

      await repository.addHistory(historyEntry);

      const history = await repository.getHistory("test-schedule-1");
      expect(history.length).toBe(1);
      expect(history[0].taskId).toBe("task-123");
      expect(history[0].status).toBe("success");
    });

    it("should get history for schedule", async () => {
      const entries = [
        {
          scheduleId: "test-schedule-1",
          executedAt: new Date("2025-01-01T10:00:00Z"),
          taskId: "task-1",
          status: "success" as const,
        },
        {
          scheduleId: "test-schedule-1",
          executedAt: new Date("2025-01-01T11:00:00Z"),
          taskId: "task-2",
          status: "failure" as const,
          error: "Test error",
        },
      ];

      for (const entry of entries) {
        await repository.addHistory(entry);
      }

      const history = await repository.getHistory("test-schedule-1");
      expect(history.length).toBe(2);
      expect(history[1].error).toBe("Test error");
    });

    it("should delete old history", async () => {
      const oldDate = new Date("2024-01-01T00:00:00Z");
      const recentDate = new Date("2025-01-01T00:00:00Z");

      await repository.addHistory({
        scheduleId: "test-schedule-1",
        executedAt: oldDate,
        taskId: "old-task",
        status: "success",
      });

      await repository.addHistory({
        scheduleId: "test-schedule-1",
        executedAt: recentDate,
        taskId: "recent-task",
        status: "success",
      });

      const cutoffDate = new Date("2024-12-01T00:00:00Z");
      await repository.deleteOldHistory(cutoffDate);

      const history = await repository.getHistory("test-schedule-1");
      expect(history.length).toBe(1);
      expect(history[0].taskId).toBe("recent-task");
    });
  });

  describe("セッション状態管理", () => {
    beforeEach(async () => {
      const schedule = createTestSchedule();
      await repository.create(schedule);
    });

    it("should get initial session state", async () => {
      const state = await repository.getSessionState("test-schedule-1");

      expect(state.scheduleId).toBe("test-schedule-1");
      expect(state.executionCount).toBe(0);
      expect(state.lastSessionReset).toBeUndefined();
    });

    it("should update session state", async () => {
      const newState: ScheduleSessionState = {
        scheduleId: "test-schedule-1",
        executionCount: 5,
        lastSessionReset: new Date("2025-01-01T12:00:00Z"),
        updatedAt: new Date(),
      };

      await repository.updateSessionState(newState);

      const state = await repository.getSessionState("test-schedule-1");
      expect(state.executionCount).toBe(5);
      expect(state.lastSessionReset).toEqual(newState.lastSessionReset);
    });

    it("should increment execution count", async () => {
      await repository.incrementExecutionCount("test-schedule-1");
      await repository.incrementExecutionCount("test-schedule-1");

      const state = await repository.getSessionState("test-schedule-1");
      expect(state.executionCount).toBe(2);
    });

    it("should reset execution count", async () => {
      // 先にカウントを増やす
      await repository.incrementExecutionCount("test-schedule-1");
      await repository.incrementExecutionCount("test-schedule-1");

      await repository.resetExecutionCount("test-schedule-1");

      const state = await repository.getSessionState("test-schedule-1");
      expect(state.executionCount).toBe(0);
      expect(state.lastSessionReset).not.toBeUndefined();
    });
  });
});
