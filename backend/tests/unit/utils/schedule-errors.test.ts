import { describe, it, expect } from "vitest";
import {
  ScheduleNotFoundError,
  InvalidScheduleError,
  InvalidCronExpressionError,
  ScheduleExecutionError,
} from "../../../src/utils/schedule-errors.js";

describe("Schedule Error Classes", () => {
  describe("ScheduleNotFoundError", () => {
    it("should create error with correct properties", () => {
      const error = new ScheduleNotFoundError("schedule-123");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ScheduleNotFoundError");
      expect(error.message).toBe("Schedule schedule-123 not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("SCHEDULE_NOT_FOUND");
      expect(error.details).toEqual({ scheduleId: "schedule-123" });
    });
  });

  describe("InvalidScheduleError", () => {
    it("should create error without field", () => {
      const error = new InvalidScheduleError("Invalid schedule configuration");

      expect(error.name).toBe("InvalidScheduleError");
      expect(error.message).toBe("Invalid schedule configuration");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("INVALID_SCHEDULE");
      expect(error.details).toBeUndefined();
    });

    it("should create error with field", () => {
      const error = new InvalidScheduleError("Invalid time format", "executeAt");

      expect(error.details).toEqual({ field: "executeAt" });
    });
  });

  describe("InvalidCronExpressionError", () => {
    it("should create error with cron expression", () => {
      const error = new InvalidCronExpressionError("* * * * * *");

      expect(error.name).toBe("InvalidCronExpressionError");
      expect(error.message).toBe("Invalid cron expression: * * * * * *");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("INVALID_CRON");
      expect(error.details).toEqual({ cronExpression: "* * * * * *" });
    });
  });

  describe("ScheduleExecutionError", () => {
    it("should create error without additional details", () => {
      const error = new ScheduleExecutionError("Execution failed", "schedule-123");

      expect(error.name).toBe("ScheduleExecutionError");
      expect(error.message).toBe("Execution failed");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("SCHEDULE_EXECUTION_ERROR");
      expect(error.details).toEqual({ scheduleId: "schedule-123" });
    });

    it("should create error with additional details", () => {
      const error = new ScheduleExecutionError("Execution failed", "schedule-123", {
        retryCount: 3,
        lastError: "Timeout",
      });

      expect(error.details).toEqual({
        scheduleId: "schedule-123",
        retryCount: 3,
        lastError: "Timeout",
      });
    });
  });
});
