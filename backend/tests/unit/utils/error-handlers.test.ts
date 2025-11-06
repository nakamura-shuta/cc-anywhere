import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorHandlers } from "../../../src/utils/error-handlers";
import { logger } from "../../../src/utils/logger";

// Mock logger
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("ErrorHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleDatabaseError", () => {
    it("should log database error with operation and context", async () => {
      const error = new Error("Database connection failed");
      const context = { taskId: "task-123", status: "running" };

      await ErrorHandlers.handleDatabaseError("update task status", context, error);

      expect(logger.error).toHaveBeenCalledWith("Failed to update task status", {
        ...context,
        error,
      });
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("should handle error without throwing", async () => {
      const error = new Error("Test error");
      const context = { taskId: "task-456" };

      await expect(
        ErrorHandlers.handleDatabaseError("update progress data", context, error),
      ).resolves.not.toThrow();
    });
  });

  describe("handleAsyncError", () => {
    it("should log async error", async () => {
      const error = new Error("Async operation failed");

      await ErrorHandlers.handleAsyncError("execute task", error);

      expect(logger.error).toHaveBeenCalledWith("Error in execute task", {
        error,
      });
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("should execute onError callback if provided", async () => {
      const error = new Error("Test error");
      const onErrorCallback = vi.fn().mockResolvedValue(undefined);

      await ErrorHandlers.handleAsyncError("execute task", error, onErrorCallback);

      expect(logger.error).toHaveBeenCalledWith("Error in execute task", {
        error,
      });
      expect(onErrorCallback).toHaveBeenCalledTimes(1);
    });

    it("should handle error in onError callback", async () => {
      const error = new Error("Original error");
      const callbackError = new Error("Callback error");
      const onErrorCallback = vi.fn().mockRejectedValue(callbackError);

      await ErrorHandlers.handleAsyncError("execute task", error, onErrorCallback);

      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenNthCalledWith(1, "Error in execute task", {
        error,
      });
      expect(logger.error).toHaveBeenNthCalledWith(2, "Error in error handler for execute task", {
        error: callbackError,
      });
      expect(onErrorCallback).toHaveBeenCalledTimes(1);
    });

    it("should work without onError callback", async () => {
      const error = new Error("Test error");

      await expect(
        ErrorHandlers.handleAsyncError("execute task", error, undefined),
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
