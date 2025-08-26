import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskGroupExecutor } from "../../../src/services/task-group-executor.js";
import { TaskExecutorImpl } from "../../../src/claude/executor.js";
import type { Task, TaskGroup } from "../../../src/types/task-groups.js";

// Mock TaskExecutorImpl
vi.mock("../../../src/claude/executor.js", () => ({
  TaskExecutorImpl: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe("TaskGroupExecutor", () => {
  let executor: TaskGroupExecutor;
  let mockTaskExecutor: any;

  beforeEach(() => {
    mockTaskExecutor = {
      execute: vi.fn().mockResolvedValue({
        status: "completed",
        result: "Task completed successfully",
        sdkSessionId: "session-123",
      }),
    };
    (TaskExecutorImpl as any).mockImplementation(() => mockTaskExecutor);
    executor = new TaskGroupExecutor();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should execute tasks sequentially when mode is sequential", async () => {
      const taskGroup: TaskGroup = {
        id: "group-1",
        name: "Sequential Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Do task 1" },
          { id: "task-2", name: "Task 2", instruction: "Do task 2", dependencies: ["task-1"] },
          { id: "task-3", name: "Task 3", instruction: "Do task 3", dependencies: ["task-2"] },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      const result = await executor.execute(taskGroup);

      expect(result.groupId).toBe("group-1");
      expect(result.status).toBe("completed");
      expect(result.tasks).toHaveLength(3);
      expect(mockTaskExecutor.execute).toHaveBeenCalledTimes(3);

      // Verify sequential execution order
      const calls = mockTaskExecutor.execute.mock.calls;
      expect(calls[0][0].instruction).toBe("Do task 1");
      expect(calls[1][0].instruction).toBe("Do task 2");
      expect(calls[2][0].instruction).toBe("Do task 3");
    });

    it("should execute independent tasks in parallel when mode is parallel", async () => {
      const taskGroup: TaskGroup = {
        id: "group-2",
        name: "Parallel Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Do task 1" },
          { id: "task-2", name: "Task 2", instruction: "Do task 2" },
          { id: "task-3", name: "Task 3", instruction: "Do task 3" },
        ],
        execution: {
          mode: "parallel",
          continueSession: true,
        },
      };

      const result = await executor.execute(taskGroup);

      expect(result.groupId).toBe("group-2");
      expect(result.status).toBe("completed");
      expect(result.tasks).toHaveLength(3);
      expect(mockTaskExecutor.execute).toHaveBeenCalledTimes(3);
    });

    it("should handle mixed mode with proper dependency resolution", async () => {
      const taskGroup: TaskGroup = {
        id: "group-3",
        name: "Mixed Test",
        tasks: [
          { id: "install", name: "Install", instruction: "npm install" },
          { id: "test", name: "Test", instruction: "npm test", dependencies: ["install"] },
          { id: "build", name: "Build", instruction: "npm build", dependencies: ["install"] },
          {
            id: "deploy",
            name: "Deploy",
            instruction: "npm deploy",
            dependencies: ["test", "build"],
          },
        ],
        execution: {
          mode: "mixed",
          continueSession: true,
        },
      };

      const result = await executor.execute(taskGroup);

      expect(result.groupId).toBe("group-3");
      expect(result.status).toBe("completed");
      expect(result.tasks).toHaveLength(4);
      expect(mockTaskExecutor.execute).toHaveBeenCalledTimes(4);

      // Verify that install was called first
      const firstCall = mockTaskExecutor.execute.mock.calls[0];
      expect(firstCall[0].instruction).toBe("npm install");

      // Verify that deploy was called last
      const lastCall = mockTaskExecutor.execute.mock.calls[3];
      expect(lastCall[0].instruction).toBe("npm deploy");
    });

    it("should detect circular dependencies", async () => {
      const taskGroup: TaskGroup = {
        id: "group-4",
        name: "Circular Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Do task 1", dependencies: ["task-3"] },
          { id: "task-2", name: "Task 2", instruction: "Do task 2", dependencies: ["task-1"] },
          { id: "task-3", name: "Task 3", instruction: "Do task 3", dependencies: ["task-2"] },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      await expect(executor.execute(taskGroup)).rejects.toThrow("Circular dependencies detected");
    });

    it("should continue with same session when continueSession is true", async () => {
      const taskGroup: TaskGroup = {
        id: "group-5",
        name: "Session Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Create file" },
          { id: "task-2", name: "Task 2", instruction: "Edit file", dependencies: ["task-1"] },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      await executor.execute(taskGroup);

      // Verify that all tasks use the same session ID
      const calls = mockTaskExecutor.execute.mock.calls;
      expect(calls).toHaveLength(2);

      // Check that second task continues from first task
      expect(calls[1][0].options.sdk).toBeDefined();
      expect(calls[1][0].options.sdk.resumeSession).toBe("session-123");
    });

    it("should handle task failure when continueOnError is false", async () => {
      mockTaskExecutor.execute.mockRejectedValueOnce(new Error("Task failed"));

      const taskGroup: TaskGroup = {
        id: "group-6",
        name: "Error Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Failing task" },
          { id: "task-2", name: "Task 2", instruction: "Should not run", dependencies: ["task-1"] },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
          continueOnError: false,
        },
      };

      await expect(executor.execute(taskGroup)).rejects.toThrow("Task failed");
      expect(mockTaskExecutor.execute).toHaveBeenCalledTimes(1);
    });

    it("should continue execution when continueOnError is true", async () => {
      mockTaskExecutor.execute
        .mockRejectedValueOnce(new Error("Task 1 failed"))
        .mockResolvedValueOnce({
          status: "completed",
          result: "Task 2 completed",
          sdkSessionId: "session-123",
        });

      const taskGroup: TaskGroup = {
        id: "group-7",
        name: "Continue on Error Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Failing task" },
          { id: "task-2", name: "Task 2", instruction: "Should run" },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
          continueOnError: true,
        },
      };

      const result = await executor.execute(taskGroup);

      expect(result.groupId).toBe("group-7");
      expect(result.status).toBe("completed"); // Change to completed if some tasks succeed
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].status).toBe("failed");
      expect(result.tasks[1].status).toBe("completed");
      expect(mockTaskExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it("should pass permissionMode to task executor", async () => {
      const taskGroup: TaskGroup = {
        id: "group-permission",
        name: "Permission Mode Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Task with permission mode" },
          { id: "task-2", name: "Task 2", instruction: "Another task" },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
          permissionMode: "bypassPermissions",
        },
      };

      await executor.execute(taskGroup);

      // Verify that permissionMode was passed to task executor
      const calls = mockTaskExecutor.execute.mock.calls;
      expect(calls).toHaveLength(2);

      // Check first task
      expect(calls[0][0].options.sdk.permissionMode).toBe("bypassPermissions");

      // Check second task
      expect(calls[1][0].options.sdk.permissionMode).toBe("bypassPermissions");
    });

    it("should use default permissionMode when not specified", async () => {
      const taskGroup: TaskGroup = {
        id: "group-default-permission",
        name: "Default Permission Mode Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Task without explicit permission mode" },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      await executor.execute(taskGroup);

      // Verify that default permissionMode was used
      const calls = mockTaskExecutor.execute.mock.calls;
      expect(calls).toHaveLength(1);

      // Should use bypassPermissions as default
      expect(calls[0][0].options.sdk.permissionMode).toBe("bypassPermissions");
    });
  });

  describe("getStatus", () => {
    it("should return current execution status", async () => {
      const taskGroup: TaskGroup = {
        id: "group-8",
        name: "Status Test",
        tasks: [{ id: "task-1", name: "Task 1", instruction: "Long running task" }],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      // Make the task execution slow
      mockTaskExecutor.execute.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ status: "completed", sdkSessionId: "session-123" }), 100),
          ),
      );

      // Start execution without waiting
      const executionPromise = executor.execute(taskGroup);

      // Check status while running
      const status = executor.getStatus("group-8");
      expect(status?.status).toBe("running");

      // Wait for completion
      await executionPromise;

      // Check status after completion
      const finalStatus = executor.getStatus("group-8");
      expect(finalStatus?.status).toBe("completed");
    });

    it("should return undefined for unknown group ID", () => {
      const status = executor.getStatus("unknown-group");
      expect(status).toBeUndefined();
    });
  });

  describe("cancel", () => {
    it.skip("should cancel running execution", async () => {
      const taskGroup: TaskGroup = {
        id: "group-9",
        name: "Cancel Test",
        tasks: [
          { id: "task-1", name: "Task 1", instruction: "Long task" },
          {
            id: "task-2",
            name: "Task 2",
            instruction: "Should be cancelled",
            dependencies: ["task-1"],
          },
        ],
        execution: {
          mode: "sequential",
          continueSession: true,
        },
      };

      // Make first task slow
      let resolveFirstTask: any;
      mockTaskExecutor.execute.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstTask = resolve;
          }),
      );

      // Start execution
      const executionPromise = executor.execute(taskGroup);

      // Cancel while first task is running
      const cancelled = await executor.cancel("group-9");
      expect(cancelled).toBe(true);

      // Complete first task
      resolveFirstTask({ status: "completed", sdkSessionId: "session-123" });

      // Wait for execution to finish
      try {
        await executionPromise;
      } catch (error) {
        // Cancellation doesn't throw in our implementation
      }

      // Second task should not have been executed
      expect(mockTaskExecutor.execute).toHaveBeenCalledTimes(1);
    });

    it("should return false when cancelling unknown group", async () => {
      const cancelled = await executor.cancel("unknown-group");
      expect(cancelled).toBe(false);
    });
  });

  describe("buildExecutionPlan", () => {
    it("should correctly order tasks with complex dependencies", () => {
      const tasks: Task[] = [
        { id: "d", name: "D", instruction: "Task D", dependencies: ["b", "c"] },
        { id: "b", name: "B", instruction: "Task B", dependencies: ["a"] },
        { id: "c", name: "C", instruction: "Task C", dependencies: ["a"] },
        { id: "a", name: "A", instruction: "Task A" },
      ];

      const stages = executor.buildExecutionPlan(tasks);

      expect(stages).toHaveLength(3);
      expect(stages[0].tasks).toHaveLength(1);
      expect(stages[0].tasks[0].id).toBe("a");
      expect(stages[1].tasks).toHaveLength(2);
      expect(stages[1].tasks.map((t: Task) => t.id).sort()).toEqual(["b", "c"]);
      expect(stages[2].tasks).toHaveLength(1);
      expect(stages[2].tasks[0].id).toBe("d");
    });

    it("should handle tasks with no dependencies", () => {
      const tasks: Task[] = [
        { id: "a", name: "A", instruction: "Task A" },
        { id: "b", name: "B", instruction: "Task B" },
        { id: "c", name: "C", instruction: "Task C" },
      ];

      const stages = executor.buildExecutionPlan(tasks);

      expect(stages).toHaveLength(1);
      expect(stages[0].tasks).toHaveLength(3);
      expect(stages[0].parallel).toBe(true);
    });
  });
});
