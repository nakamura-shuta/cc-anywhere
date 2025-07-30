import { describe, it, expect } from "vitest";
import {
  TaskNotFoundError,
  InvalidTaskRequestError,
  TaskExecutionError,
  TaskCancellationError,
  WorkerNotAvailableError,
  BatchTaskError,
  SessionNotFoundError,
  RepositoryNotFoundError,
  PresetNotFoundError,
  InvalidPresetError,
} from "../../../src/utils/task-errors.js";

describe("Task Error Classes", () => {
  describe("TaskNotFoundError", () => {
    it("should create error with correct properties", () => {
      const error = new TaskNotFoundError("task-123");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("TaskNotFoundError");
      expect(error.message).toBe("Task task-123 not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("TASK_NOT_FOUND");
      expect(error.details).toEqual({ taskId: "task-123" });
    });
  });

  describe("InvalidTaskRequestError", () => {
    it("should create error without field", () => {
      const error = new InvalidTaskRequestError("Invalid request");

      expect(error.name).toBe("InvalidTaskRequestError");
      expect(error.message).toBe("Invalid request");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("INVALID_TASK_REQUEST");
      expect(error.details).toBeUndefined();
    });

    it("should create error with field", () => {
      const error = new InvalidTaskRequestError("Invalid instruction", "instruction");

      expect(error.details).toEqual({ field: "instruction" });
    });
  });

  describe("TaskExecutionError", () => {
    it("should create error without original error", () => {
      const error = new TaskExecutionError("Execution failed", "task-123");

      expect(error.name).toBe("TaskExecutionError");
      expect(error.message).toBe("Execution failed");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("TASK_EXECUTION_ERROR");
      expect(error.details).toEqual({
        taskId: "task-123",
        originalError: undefined,
      });
    });

    it("should create error with original error", () => {
      const originalError = new Error("Network timeout");
      const error = new TaskExecutionError("Execution failed", "task-123", originalError);

      expect(error.details).toEqual({
        taskId: "task-123",
        originalError: "Network timeout",
      });
    });
  });

  describe("TaskCancellationError", () => {
    it("should create error with default message", () => {
      const error = new TaskCancellationError("task-123");

      expect(error.message).toBe("Task task-123 cancellation failed");
      expect(error.details).toEqual({
        taskId: "task-123",
        reason: undefined,
      });
    });

    it("should create error with custom reason", () => {
      const error = new TaskCancellationError("task-123", "User requested");

      expect(error.message).toBe("User requested");
      expect(error.details).toEqual({
        taskId: "task-123",
        reason: "User requested",
      });
    });
  });

  describe("WorkerNotAvailableError", () => {
    it("should create error with default message", () => {
      const error = new WorkerNotAvailableError();

      expect(error.name).toBe("WorkerNotAvailableError");
      expect(error.message).toBe("No workers available");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("WORKER_NOT_AVAILABLE");
    });

    it("should create error with custom message", () => {
      const error = new WorkerNotAvailableError("All workers are busy");

      expect(error.message).toBe("All workers are busy");
    });
  });

  describe("BatchTaskError", () => {
    it("should create error with failed tasks", () => {
      const failedTasks = [
        { taskId: "task-1", error: "Timeout" },
        { taskId: "task-2", error: "Invalid input" },
      ];
      const error = new BatchTaskError("Batch execution failed", failedTasks);

      expect(error.name).toBe("BatchTaskError");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("BATCH_TASK_ERROR");
      expect(error.details).toEqual({ failedTasks });
    });
  });

  describe("SessionNotFoundError", () => {
    it("should create error with correct properties", () => {
      const error = new SessionNotFoundError("session-456");

      expect(error.message).toBe("Session session-456 not found");
      expect(error.code).toBe("SESSION_NOT_FOUND");
      expect(error.details).toEqual({ sessionId: "session-456" });
    });
  });

  describe("RepositoryNotFoundError", () => {
    it("should create error with correct properties", () => {
      const error = new RepositoryNotFoundError("my-repo");

      expect(error.message).toBe("Repository my-repo not found");
      expect(error.code).toBe("REPOSITORY_NOT_FOUND");
      expect(error.details).toEqual({ repositoryName: "my-repo" });
    });
  });

  describe("PresetNotFoundError", () => {
    it("should create error with correct properties", () => {
      const error = new PresetNotFoundError("preset-789");

      expect(error.message).toBe("Preset preset-789 not found");
      expect(error.code).toBe("PRESET_NOT_FOUND");
      expect(error.details).toEqual({ presetId: "preset-789" });
    });
  });

  describe("InvalidPresetError", () => {
    it("should create error without presetId", () => {
      const error = new InvalidPresetError("Invalid preset format");

      expect(error.name).toBe("InvalidPresetError");
      expect(error.code).toBe("INVALID_PRESET");
      expect(error.details).toBeUndefined();
    });

    it("should create error with presetId", () => {
      const error = new InvalidPresetError("Invalid preset format", "preset-123");

      expect(error.details).toEqual({ presetId: "preset-123" });
    });
  });
});
