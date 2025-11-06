import { describe, it, expect, beforeEach } from "vitest";
import { BaseExecutorHelper } from "../../../src/agents/base-executor-helper.js";

describe("BaseExecutorHelper", () => {
  let helper: BaseExecutorHelper;

  beforeEach(() => {
    helper = new BaseExecutorHelper("test-task");
  });

  describe("generateTaskId", () => {
    it("should generate task ID with correct prefix", () => {
      const taskId = helper.generateTaskId();
      expect(taskId).toMatch(/^test-task-/);
    });

    it("should generate unique task IDs", () => {
      const taskId1 = helper.generateTaskId();
      const taskId2 = helper.generateTaskId();
      expect(taskId1).not.toBe(taskId2);
    });

    it("should generate task ID with timestamp component", () => {
      const taskId = helper.generateTaskId();
      // Format: prefix-timestamp-random
      const parts = taskId.split("-");
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe("test");
      expect(parts[1]).toBe("task");
      // Timestamp should be a valid number
      const timestamp = parseInt(parts[2]);
      expect(timestamp).toBeGreaterThan(0);
    });
  });

  describe("trackTask", () => {
    it("should track task with AbortController", () => {
      const taskId = "task-123";
      const controller = new AbortController();

      helper.trackTask(taskId, controller);

      expect(helper.isTaskCancellable(taskId)).toBe(true);
    });

    it("should track multiple tasks", () => {
      const taskId1 = "task-123";
      const taskId2 = "task-456";
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      helper.trackTask(taskId1, controller1);
      helper.trackTask(taskId2, controller2);

      expect(helper.isTaskCancellable(taskId1)).toBe(true);
      expect(helper.isTaskCancellable(taskId2)).toBe(true);
      expect(helper.getRunningTaskCount()).toBe(2);
    });
  });

  describe("untrackTask", () => {
    it("should remove task from tracking", () => {
      const taskId = "task-123";
      const controller = new AbortController();

      helper.trackTask(taskId, controller);
      expect(helper.isTaskCancellable(taskId)).toBe(true);

      helper.untrackTask(taskId);
      expect(helper.isTaskCancellable(taskId)).toBe(false);
    });

    it("should not throw error when untracking non-existent task", () => {
      expect(() => helper.untrackTask("non-existent")).not.toThrow();
    });
  });

  describe("isTaskCancellable", () => {
    it("should return true for tracked task", () => {
      const taskId = "task-123";
      const controller = new AbortController();

      helper.trackTask(taskId, controller);

      expect(helper.isTaskCancellable(taskId)).toBe(true);
    });

    it("should return false for untracked task", () => {
      expect(helper.isTaskCancellable("unknown-task")).toBe(false);
    });

    it("should return false after task is untracked", () => {
      const taskId = "task-123";
      const controller = new AbortController();

      helper.trackTask(taskId, controller);
      helper.untrackTask(taskId);

      expect(helper.isTaskCancellable(taskId)).toBe(false);
    });
  });

  describe("cancelTrackedTask", () => {
    it("should cancel and untrack task", async () => {
      const taskId = "task-123";
      const controller = new AbortController();

      helper.trackTask(taskId, controller);
      const result = await helper.cancelTrackedTask(taskId);

      expect(result).toBe(true);
      expect(controller.signal.aborted).toBe(true);
      expect(helper.isTaskCancellable(taskId)).toBe(false);
    });

    it("should return false for unknown task", async () => {
      const result = await helper.cancelTrackedTask("unknown-task");
      expect(result).toBe(false);
    });

    it("should abort the controller signal", async () => {
      const taskId = "task-123";
      const controller = new AbortController();
      let aborted = false;

      controller.signal.addEventListener("abort", () => {
        aborted = true;
      });

      helper.trackTask(taskId, controller);
      await helper.cancelTrackedTask(taskId);

      expect(aborted).toBe(true);
    });

    it("should remove task from running tasks after cancellation", async () => {
      const taskId = "task-123";
      const controller = new AbortController();

      helper.trackTask(taskId, controller);
      expect(helper.getRunningTaskCount()).toBe(1);

      await helper.cancelTrackedTask(taskId);
      expect(helper.getRunningTaskCount()).toBe(0);
    });
  });

  describe("getRunningTaskCount", () => {
    it("should return 0 for no tracked tasks", () => {
      expect(helper.getRunningTaskCount()).toBe(0);
    });

    it("should return correct count for tracked tasks", () => {
      helper.trackTask("task-1", new AbortController());
      expect(helper.getRunningTaskCount()).toBe(1);

      helper.trackTask("task-2", new AbortController());
      expect(helper.getRunningTaskCount()).toBe(2);

      helper.trackTask("task-3", new AbortController());
      expect(helper.getRunningTaskCount()).toBe(3);
    });

    it("should decrease count when task is untracked", () => {
      helper.trackTask("task-1", new AbortController());
      helper.trackTask("task-2", new AbortController());
      expect(helper.getRunningTaskCount()).toBe(2);

      helper.untrackTask("task-1");
      expect(helper.getRunningTaskCount()).toBe(1);
    });
  });

  describe("getRunningTaskIds", () => {
    it("should return empty array for no tracked tasks", () => {
      const taskIds = helper.getRunningTaskIds();
      expect(taskIds).toEqual([]);
    });

    it("should return list of task IDs", () => {
      helper.trackTask("task-1", new AbortController());
      helper.trackTask("task-2", new AbortController());

      const taskIds = helper.getRunningTaskIds();
      expect(taskIds).toContain("task-1");
      expect(taskIds).toContain("task-2");
      expect(taskIds).toHaveLength(2);
    });

    it("should update list when tasks are added and removed", () => {
      helper.trackTask("task-1", new AbortController());
      helper.trackTask("task-2", new AbortController());
      helper.trackTask("task-3", new AbortController());

      let taskIds = helper.getRunningTaskIds();
      expect(taskIds).toHaveLength(3);

      helper.untrackTask("task-2");
      taskIds = helper.getRunningTaskIds();
      expect(taskIds).toHaveLength(2);
      expect(taskIds).toContain("task-1");
      expect(taskIds).toContain("task-3");
      expect(taskIds).not.toContain("task-2");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete task lifecycle", async () => {
      const taskId = helper.generateTaskId();
      const controller = new AbortController();

      // Track task
      helper.trackTask(taskId, controller);
      expect(helper.isTaskCancellable(taskId)).toBe(true);
      expect(helper.getRunningTaskCount()).toBe(1);

      // Cancel task
      const cancelled = await helper.cancelTrackedTask(taskId);
      expect(cancelled).toBe(true);
      expect(controller.signal.aborted).toBe(true);
      expect(helper.isTaskCancellable(taskId)).toBe(false);
      expect(helper.getRunningTaskCount()).toBe(0);
    });

    it("should handle multiple concurrent tasks", async () => {
      const tasks = [
        { id: "task-1", controller: new AbortController() },
        { id: "task-2", controller: new AbortController() },
        { id: "task-3", controller: new AbortController() },
      ];

      // Track all tasks
      tasks.forEach((task) => helper.trackTask(task.id, task.controller));
      expect(helper.getRunningTaskCount()).toBe(3);

      // Cancel middle task
      await helper.cancelTrackedTask("task-2");
      expect(helper.getRunningTaskCount()).toBe(2);
      expect(helper.isTaskCancellable("task-1")).toBe(true);
      expect(helper.isTaskCancellable("task-2")).toBe(false);
      expect(helper.isTaskCancellable("task-3")).toBe(true);

      // Cancel remaining tasks
      await helper.cancelTrackedTask("task-1");
      await helper.cancelTrackedTask("task-3");
      expect(helper.getRunningTaskCount()).toBe(0);
    });
  });
});
