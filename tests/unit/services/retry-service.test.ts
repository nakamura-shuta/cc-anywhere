import { describe, it, expect } from "vitest";
import { RetryService } from "../../../src/services/retry-service";
import { RetryPolicy, type RetryConfig } from "../../../src/claude/types";

describe("RetryService", () => {
  describe("calculateRetryDelay", () => {
    it("should return 0 for NONE policy", () => {
      const config: RetryConfig = { policy: RetryPolicy.NONE };
      const delay = RetryService.calculateRetryDelay(1, config);
      expect(delay).toBe(0);
    });

    it("should calculate linear delay correctly", () => {
      const config: RetryConfig = {
        policy: RetryPolicy.LINEAR,
        initialDelay: 1000,
      };

      // Without jitter, delays would be exactly 1000, 2000, 3000
      const delay1 = RetryService.calculateRetryDelay(1, config);
      const delay2 = RetryService.calculateRetryDelay(2, config);
      const delay3 = RetryService.calculateRetryDelay(3, config);

      // Check they are within 10% jitter range
      expect(delay1).toBeGreaterThanOrEqual(900);
      expect(delay1).toBeLessThanOrEqual(1100);

      expect(delay2).toBeGreaterThanOrEqual(1800);
      expect(delay2).toBeLessThanOrEqual(2200);

      expect(delay3).toBeGreaterThanOrEqual(2700);
      expect(delay3).toBeLessThanOrEqual(3300);
    });

    it("should calculate exponential delay correctly", () => {
      const config: RetryConfig = {
        policy: RetryPolicy.EXPONENTIAL,
        initialDelay: 1000,
        backoffMultiplier: 2,
      };

      // Without jitter, delays would be exactly 1000, 2000, 4000
      const delay1 = RetryService.calculateRetryDelay(1, config);
      const delay2 = RetryService.calculateRetryDelay(2, config);
      const delay3 = RetryService.calculateRetryDelay(3, config);

      // Check they are within 10% jitter range
      expect(delay1).toBeGreaterThanOrEqual(900);
      expect(delay1).toBeLessThanOrEqual(1100);

      expect(delay2).toBeGreaterThanOrEqual(1800);
      expect(delay2).toBeLessThanOrEqual(2200);

      expect(delay3).toBeGreaterThanOrEqual(3600);
      expect(delay3).toBeLessThanOrEqual(4400);
    });

    it("should respect maxDelay", () => {
      const config: RetryConfig = {
        policy: RetryPolicy.EXPONENTIAL,
        initialDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 5000,
      };

      // This would be 100000 without max delay
      const delay = RetryService.calculateRetryDelay(3, config);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it("should use default values when not specified", () => {
      const delay = RetryService.calculateRetryDelay(1);
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for any error when no retryableErrors configured", () => {
      const error = new Error("Some error");
      const result = RetryService.isRetryableError(error);
      expect(result).toBe(true);
    });

    it("should match error message patterns", () => {
      const config: RetryConfig = {
        retryableErrors: ["timeout", "network"],
      };

      expect(RetryService.isRetryableError(new Error("Connection timeout"), config)).toBe(true);
      expect(RetryService.isRetryableError(new Error("Network error"), config)).toBe(true);
      expect(RetryService.isRetryableError(new Error("Invalid input"), config)).toBe(false);
    });

    it("should match error codes", () => {
      const config: RetryConfig = {
        retryableErrors: ["ECONNREFUSED", "ETIMEDOUT"],
      };

      const error1 = { message: "Connection refused", code: "ECONNREFUSED" };
      const error2 = { message: "Request timeout", code: "ETIMEDOUT" };
      const error3 = { message: "Not found", code: "ENOTFOUND" };

      expect(RetryService.isRetryableError(error1, config)).toBe(true);
      expect(RetryService.isRetryableError(error2, config)).toBe(true);
      expect(RetryService.isRetryableError(error3, config)).toBe(false);
    });

    it("should be case insensitive", () => {
      const config: RetryConfig = {
        retryableErrors: ["TIMEOUT"],
      };

      expect(RetryService.isRetryableError(new Error("timeout error"), config)).toBe(true);
      expect(RetryService.isRetryableError({ message: "Error", code: "timeout" }, config)).toBe(
        true,
      );
    });
  });

  describe("shouldRetry", () => {
    it("should return false when max retries reached", () => {
      const config: RetryConfig = { maxRetries: 3 };
      const error = new Error("Some error");

      expect(RetryService.shouldRetry(3, error, config)).toBe(false);
      expect(RetryService.shouldRetry(4, error, config)).toBe(false);
    });

    it("should return false for non-retryable errors", () => {
      const config: RetryConfig = {
        maxRetries: 3,
        retryableErrors: ["timeout"],
      };
      const error = new Error("Invalid input");

      expect(RetryService.shouldRetry(1, error, config)).toBe(false);
    });

    it("should return true when retries available and error is retryable", () => {
      const config: RetryConfig = {
        maxRetries: 3,
        retryableErrors: ["timeout"],
      };
      const error = new Error("Connection timeout");

      expect(RetryService.shouldRetry(0, error, config)).toBe(true);
      expect(RetryService.shouldRetry(1, error, config)).toBe(true);
      expect(RetryService.shouldRetry(2, error, config)).toBe(true);
    });

    it("should use default max retries when not specified", () => {
      const error = new Error("Some error");
      expect(RetryService.shouldRetry(0, error)).toBe(true);
      expect(RetryService.shouldRetry(3, error)).toBe(false);
    });
  });

  describe("createInitialRetryMetadata", () => {
    it("should create metadata with specified max retries", () => {
      const config: RetryConfig = { maxRetries: 5 };
      const metadata = RetryService.createInitialRetryMetadata(config);

      expect(metadata).toEqual({
        currentAttempt: 0,
        maxRetries: 5,
        retryHistory: [],
      });
    });

    it("should use default max retries when not specified", () => {
      const metadata = RetryService.createInitialRetryMetadata();

      expect(metadata).toEqual({
        currentAttempt: 0,
        maxRetries: 3,
        retryHistory: [],
      });
    });
  });

  describe("updateRetryMetadata", () => {
    it("should create initial metadata if not provided", () => {
      const error = { message: "Test error", code: "TEST" };
      const startedAt = new Date("2024-01-15T10:00:00Z");
      const completedAt = new Date("2024-01-15T10:01:00Z");

      const metadata = RetryService.updateRetryMetadata(undefined, error, startedAt, completedAt);

      expect(metadata.currentAttempt).toBe(1);
      expect(metadata.retryHistory).toHaveLength(1);
      expect(metadata.retryHistory[0]).toMatchObject({
        attemptNumber: 0,
        startedAt,
        completedAt,
        error,
      });
    });

    it("should increment attempt and add to history", () => {
      const initialMetadata = {
        currentAttempt: 1,
        maxRetries: 3,
        retryHistory: [
          {
            attemptNumber: 0,
            startedAt: new Date("2024-01-15T09:00:00Z"),
            completedAt: new Date("2024-01-15T09:01:00Z"),
            error: { message: "First error" },
          },
        ],
      };

      const error = { message: "Second error" };
      const startedAt = new Date("2024-01-15T10:00:00Z");
      const completedAt = new Date("2024-01-15T10:01:00Z");

      const metadata = RetryService.updateRetryMetadata(
        initialMetadata,
        error,
        startedAt,
        completedAt,
      );

      expect(metadata.currentAttempt).toBe(2);
      expect(metadata.retryHistory).toHaveLength(2);
      expect(metadata.retryHistory[1]).toMatchObject({
        attemptNumber: 1,
        error,
      });
    });

    it("should calculate next retry time", () => {
      const config: RetryConfig = {
        initialDelay: 1000,
        policy: RetryPolicy.EXPONENTIAL,
      };

      const metadata = RetryService.updateRetryMetadata(
        undefined,
        { message: "Error" },
        new Date(),
        new Date(),
        config,
      );

      expect(metadata.nextRetryAt).toBeDefined();
      expect(metadata.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
