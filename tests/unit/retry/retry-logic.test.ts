import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TaskRequest, RetryConfig, ClaudeExecutionResult } from "../../../src/claude/types.js";
import { RetryPolicy } from "../../../src/claude/types.js";

// Mock implementation for testing retry logic
class RetryHandler {
  async executeWithRetry(
    taskRequest: TaskRequest,
    executeFn: () => Promise<ClaudeExecutionResult>,
    onRetryAttempt?: (attempt: number, error: Error, delay: number) => void,
  ): Promise<ClaudeExecutionResult> {
    const retryConfig = this.getRetryConfig(taskRequest.options?.retry);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await executeFn();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === retryConfig.maxRetries) {
          break; // No more retries
        }

        if (!this.shouldRetry(error as Error, retryConfig)) {
          throw error; // Error not retryable
        }

        const delay = this.calculateDelay(attempt, retryConfig);
        if (onRetryAttempt) {
          onRetryAttempt(attempt + 1, error as Error, delay);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private getRetryConfig(config?: RetryConfig): Required<RetryConfig> {
    return {
      maxRetries: config?.maxRetries ?? 3,
      initialDelay: config?.initialDelay ?? 1000,
      maxDelay: config?.maxDelay ?? 60000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      retryableErrors: config?.retryableErrors ?? [],
      policy: config?.policy ?? RetryPolicy.EXPONENTIAL,
    };
  }

  private shouldRetry(error: Error, config: Required<RetryConfig>): boolean {
    if (config.policy === RetryPolicy.NONE) {
      return false; // No retry when policy is NONE
    }

    if (config.retryableErrors.length === 0) {
      return true; // Retry all errors if no specific errors defined
    }

    return config.retryableErrors.some(
      (retryableError) =>
        error.message.includes(retryableError) || (error as any).code === retryableError,
    );
  }

  private calculateDelay(attempt: number, config: Required<RetryConfig>): number {
    let delay: number;

    switch (config.policy) {
      case RetryPolicy.LINEAR:
        delay = config.initialDelay;
        break;
      case RetryPolicy.EXPONENTIAL:
        delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
        break;
      case RetryPolicy.NONE:
        delay = 0;
        break;
      default:
        delay = config.initialDelay;
    }

    return Math.min(delay, config.maxDelay);
  }
}

describe("Retry Logic Implementation", () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    retryHandler = new RetryHandler();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Basic Retry Behavior", () => {
    it("should succeed on first attempt without retry", async () => {
      const executeFn = vi.fn().mockResolvedValue({
        success: true,
        output: "Success",
        logs: [],
        duration: 100,
      });

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 3,
          },
        },
      };

      const result = await retryHandler.executeWithRetry(task, executeFn);

      expect(executeFn).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("should retry on failure and succeed", async () => {
      const executeFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce({
          success: true,
          output: "Success after retry",
          logs: [],
          duration: 100,
        });

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 3,
            initialDelay: 100,
          },
        },
      };

      const retryAttempts: Array<{ attempt: number; error: Error; delay: number }> = [];

      const resultPromise = retryHandler.executeWithRetry(
        task,
        executeFn,
        (attempt, error, delay) => {
          retryAttempts.push({ attempt, error, delay });
        },
      );

      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(executeFn).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(retryAttempts).toHaveLength(1);
      expect(retryAttempts[0].attempt).toBe(1);
      expect(retryAttempts[0].delay).toBe(100);
    });

    it("should fail after max retries exceeded", async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error("Persistent error"));

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 2,
            initialDelay: 10,
          },
        },
      };

      const retryAttempts: number[] = [];

      const resultPromise = retryHandler.executeWithRetry(task, executeFn, (attempt) => {
        retryAttempts.push(attempt);
      });

      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(30); // 10ms + 20ms

      await expect(resultPromise).rejects.toThrow("Persistent error");
      expect(executeFn).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(retryAttempts).toEqual([1, 2]);
    });
  });

  describe("Exponential Backoff", () => {
    it("should apply exponential backoff correctly", async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error("Error"));

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 4,
            initialDelay: 100,
            backoffMultiplier: 2,
            policy: RetryPolicy.EXPONENTIAL,
          },
        },
      };

      const delays: number[] = [];

      const resultPromise = retryHandler.executeWithRetry(
        task,
        executeFn,
        (attempt, error, delay) => {
          delays.push(delay);
        },
      );

      // Fast-forward through all delays
      await vi.advanceTimersByTimeAsync(100 + 200 + 400 + 800);

      await expect(resultPromise).rejects.toThrow();

      // Expected delays: 100, 200, 400, 800
      expect(delays).toEqual([100, 200, 400, 800]);
    });

    it("should respect maxDelay limit", async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error("Error"));

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 5,
            initialDelay: 1000,
            maxDelay: 3000,
            backoffMultiplier: 3,
            policy: RetryPolicy.EXPONENTIAL,
          },
        },
      };

      const delays: number[] = [];

      const resultPromise = retryHandler.executeWithRetry(
        task,
        executeFn,
        (attempt, error, delay) => {
          delays.push(delay);
        },
      );

      // Fast-forward
      await vi.advanceTimersByTimeAsync(20000);

      await expect(resultPromise).rejects.toThrow();

      // Expected: 1000, 3000 (capped), 3000 (capped), 3000 (capped), 3000 (capped)
      expect(delays).toEqual([1000, 3000, 3000, 3000, 3000]);
    });
  });

  describe("Linear Backoff", () => {
    it("should apply linear backoff correctly", async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error("Error"));

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 3,
            initialDelay: 500,
            policy: RetryPolicy.LINEAR,
          },
        },
      };

      const delays: number[] = [];

      const resultPromise = retryHandler.executeWithRetry(
        task,
        executeFn,
        (attempt, error, delay) => {
          delays.push(delay);
        },
      );

      await vi.advanceTimersByTimeAsync(2000);

      await expect(resultPromise).rejects.toThrow();

      // All delays should be the same for linear
      expect(delays).toEqual([500, 500, 500]);
    });
  });

  describe("Selective Retry", () => {
    it("should retry only specified error types", async () => {
      const networkError = new Error("NETWORK_ERROR: Connection failed");
      const authError = new Error("AUTH_ERROR: Invalid credentials");

      const executeFn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(authError);

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 3,
            initialDelay: 10,
            retryableErrors: ["NETWORK_ERROR", "TIMEOUT"],
          },
        },
      };

      const resultPromise = retryHandler.executeWithRetry(task, executeFn);

      await vi.advanceTimersByTimeAsync(20);

      // Should retry network error but not auth error
      await expect(resultPromise).rejects.toThrow("AUTH_ERROR");
      expect(executeFn).toHaveBeenCalledTimes(2);
    });

    it("should retry all errors when retryableErrors is empty array", async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error("Any error"));

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 3,
            initialDelay: 10,
            retryableErrors: [],
          },
        },
      };

      const retryAttempts: number[] = [];

      const resultPromise = retryHandler.executeWithRetry(task, executeFn, (attempt) => {
        retryAttempts.push(attempt);
      });

      // Fast forward through all delays (10ms * 3)
      await vi.advanceTimersByTimeAsync(100);

      // Should retry all errors when array is empty (default behavior)
      await expect(resultPromise).rejects.toThrow("Any error");
      expect(executeFn).toHaveBeenCalledTimes(4); // initial + 3 retries
      expect(retryAttempts).toEqual([1, 2, 3]);
    });

    it("should check error code property", async () => {
      const errorWithCode = Object.assign(new Error("Request failed"), {
        code: "ECONNREFUSED",
      });

      const executeFn = vi.fn().mockRejectedValue(errorWithCode);

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 2,
            initialDelay: 10,
            retryableErrors: ["ECONNREFUSED", "ETIMEDOUT"],
          },
        },
      };

      const resultPromise = retryHandler.executeWithRetry(task, executeFn);
      await vi.advanceTimersByTimeAsync(50);

      await expect(resultPromise).rejects.toThrow();
      expect(executeFn).toHaveBeenCalledTimes(3); // Should retry
    });
  });

  describe("No Retry Policy", () => {
    it("should not retry when policy is NONE", async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error("Error"));

      const task: TaskRequest = {
        instruction: "Test task",
        options: {
          retry: {
            maxRetries: 3,
            policy: RetryPolicy.NONE,
          },
        },
      };

      await expect(retryHandler.executeWithRetry(task, executeFn)).rejects.toThrow();

      expect(executeFn).toHaveBeenCalledTimes(1); // No retries
    });
  });
});
