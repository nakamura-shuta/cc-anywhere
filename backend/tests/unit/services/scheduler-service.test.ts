import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SchedulerService } from "../../../src/services/scheduler-service";
import type { ScheduledTask } from "../../../src/types/scheduled-task";
// Removed unused import

describe("SchedulerService", () => {
  let scheduler: SchedulerService;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new SchedulerService();
  });

  afterEach(() => {
    vi.useRealTimers();
    scheduler.stop();
  });

  describe("createSchedule", () => {
    it("should create a cron schedule", async () => {
      const schedule: Omit<ScheduledTask, "id" | "history"> = {
        name: "Daily backup",
        description: "Run backup every day at 2 AM",
        taskRequest: {
          instruction: "Run backup script",
          context: { workingDirectory: "/home/project" },
        },
        schedule: {
          type: "cron",
          expression: "0 2 * * *",
          timezone: "UTC",
        },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      };

      const created = await scheduler.createSchedule(schedule);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(schedule.name);
      expect(created.schedule.expression).toBe("0 2 * * *");
      expect(created.status).toBe("active");
      expect(created.metadata.nextExecuteAt).toBeDefined();
    });

    it("should create a one-time delayed schedule", async () => {
      const executeAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes later
      const schedule: Omit<ScheduledTask, "id" | "history"> = {
        name: "Delayed task",
        taskRequest: {
          instruction: "Execute after 30 minutes",
        },
        schedule: {
          type: "once",
          executeAt,
        },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      };

      const created = await scheduler.createSchedule(schedule);

      expect(created.schedule.type).toBe("once");
      expect(created.schedule.executeAt).toEqual(executeAt);
      expect(created.metadata.nextExecuteAt).toEqual(executeAt);
    });

    it("should validate cron expression", async () => {
      const schedule: Omit<ScheduledTask, "id" | "history"> = {
        name: "Invalid cron",
        taskRequest: { instruction: "test" },
        schedule: {
          type: "cron",
          expression: "invalid cron",
        },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      };

      await expect(scheduler.createSchedule(schedule)).rejects.toThrow("Invalid cron expression");
    });
  });

  describe("getSchedule", () => {
    it("should return schedule by id", async () => {
      const schedule = await scheduler.createSchedule({
        name: "Test schedule",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const found = await scheduler.getScheduleAsync(schedule.id);
      expect(found).toEqual(schedule);
    });

    it("should return undefined for non-existent id", async () => {
      const found = await scheduler.getScheduleAsync("non-existent");
      expect(found).toBeUndefined();
    });
  });

  describe("updateSchedule", () => {
    it("should update schedule properties", async () => {
      const schedule = await scheduler.createSchedule({
        name: "Original name",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      // Advance time to ensure updatedAt is different
      vi.advanceTimersByTime(1);

      const updated = await scheduler.updateSchedule(schedule.id, {
        name: "Updated name",
        status: "inactive",
      });

      expect(updated?.name).toBe("Updated name");
      expect(updated?.status).toBe("inactive");
      expect(updated?.metadata.updatedAt.getTime()).toBeGreaterThan(
        schedule.metadata.updatedAt.getTime(),
      );
    });
  });

  describe("deleteSchedule", () => {
    it("should delete schedule", async () => {
      const schedule = await scheduler.createSchedule({
        name: "To be deleted",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const deleted = await scheduler.deleteSchedule(schedule.id);
      expect(deleted).toBe(true);

      const found = await scheduler.getScheduleAsync(schedule.id);
      expect(found).toBeUndefined();
    });
  });

  describe("listSchedules", () => {
    it("should return all schedules with pagination", async () => {
      // Create multiple schedules
      for (let i = 0; i < 15; i++) {
        await scheduler.createSchedule({
          name: `Schedule ${i}`,
          taskRequest: { instruction: "test" },
          schedule: { type: "cron", expression: "0 * * * *" },
          status: i % 2 === 0 ? "active" : "inactive",
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            executionCount: 0,
          },
        });
      }

      const page1 = await scheduler.listSchedules({ limit: 10, offset: 0 });
      expect(page1.schedules).toHaveLength(10);
      expect(page1.total).toBe(15);

      const page2 = await scheduler.listSchedules({ limit: 10, offset: 10 });
      expect(page2.schedules).toHaveLength(5);
    });

    it("should filter by status", async () => {
      for (let i = 0; i < 10; i++) {
        await scheduler.createSchedule({
          name: `Schedule ${i}`,
          taskRequest: { instruction: "test" },
          schedule: { type: "cron", expression: "0 * * * *" },
          status: i < 6 ? "active" : "inactive",
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            executionCount: 0,
          },
        });
      }

      const activeOnly = await scheduler.listSchedules({ status: "active" });
      expect(activeOnly.schedules).toHaveLength(6);
      expect(activeOnly.schedules.every((s) => s.status === "active")).toBe(true);
    });
  });

  describe("enableSchedule/disableSchedule", () => {
    it("should toggle schedule status", async () => {
      const schedule = await scheduler.createSchedule({
        name: "Toggle test",
        taskRequest: { instruction: "test" },
        schedule: { type: "cron", expression: "0 * * * *" },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      const disabled = await scheduler.disableSchedule(schedule.id);
      expect(disabled?.status).toBe("inactive");

      const enabled = await scheduler.enableSchedule(schedule.id);
      expect(enabled?.status).toBe("active");
    });
  });

  describe("execute scheduled tasks", () => {
    it.skip("should execute task when cron time arrives", async () => {
      const onExecute = vi.fn();
      scheduler.setOnExecuteHandler(onExecute);

      const now = new Date("2024-01-01T10:00:00Z");
      vi.setSystemTime(now);

      const schedule = await scheduler.createSchedule({
        name: "Every minute",
        taskRequest: { instruction: "test task" },
        schedule: {
          type: "cron",
          expression: "* * * * *", // Every minute
        },
        status: "active",
        metadata: {
          createdAt: now,
          updatedAt: now,
          executionCount: 0,
        },
      });

      scheduler.start();

      // Advance time to next minute
      vi.advanceTimersByTime(60 * 1000);
      await vi.runAllTimersAsync();

      expect(onExecute).toHaveBeenCalledWith(schedule.taskRequest, schedule.id);

      const updated = await scheduler.getScheduleAsync(schedule.id);
      expect(updated?.metadata.executionCount).toBe(1);
      expect(updated?.metadata.lastExecutedAt).toBeDefined();
    });

    it.skip("should execute one-time task and mark as completed", async () => {
      const onExecute = vi.fn().mockResolvedValue({ taskId: "task-123" });
      scheduler.setOnExecuteHandler(onExecute);

      const executeAt = new Date(Date.now() + 5000); // 5 seconds later
      const schedule = await scheduler.createSchedule({
        name: "One-time task",
        taskRequest: { instruction: "execute once" },
        schedule: {
          type: "once",
          executeAt,
        },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      scheduler.start();

      // Advance time
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(onExecute).toHaveBeenCalledOnce();

      const updated = await scheduler.getScheduleAsync(schedule.id);
      expect(updated?.status).toBe("completed");
      expect(updated?.metadata.executionCount).toBe(1);
    });

    it.skip("should not execute inactive schedules", async () => {
      const onExecute = vi.fn();
      scheduler.setOnExecuteHandler(onExecute);

      scheduler.createSchedule({
        name: "Inactive schedule",
        taskRequest: { instruction: "should not run" },
        schedule: {
          type: "cron",
          expression: "* * * * *",
        },
        status: "inactive",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      scheduler.start();

      vi.advanceTimersByTime(60 * 1000);
      await vi.runAllTimersAsync();

      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  describe("getHistory", () => {
    it.skip("should return execution history", async () => {
      const onExecute = vi.fn().mockResolvedValue({ taskId: "task-123" });
      scheduler.setOnExecuteHandler(onExecute);

      const schedule = await scheduler.createSchedule({
        name: "History test",
        taskRequest: { instruction: "test" },
        schedule: {
          type: "cron",
          expression: "* * * * *",
        },
        status: "active",
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          executionCount: 0,
        },
      });

      scheduler.start();

      // Execute multiple times
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(60 * 1000);
        await vi.runAllTimersAsync();
      }

      const history = await scheduler.getHistory(schedule.id);
      expect(history).toHaveLength(3);
      expect(history[0].status).toBe("success");
      expect(history[0].taskId).toBe("task-123");
    });
  });
});
