import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RetryHandler } from "../../../src/services/retry-handler.js";
import type { TaskRequest } from "../../../src/claude/types.js";

describe("Simple Retry Handler Test", () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    retryHandler = new RetryHandler();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should retry and succeed on second attempt", async () => {
    const task: TaskRequest = {
      instruction: "Test task",
      options: {
        retry: {
          maxRetries: 2,
          initialDelay: 100,
        },
      },
    };

    let attemptCount = 0;
    const executeFn = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error("First attempt failed");
      }
      return {
        success: true,
        output: "Success on second attempt",
        logs: [],
        duration: 100,
      };
    });

    const resultPromise = retryHandler.executeWithRetry(task, executeFn);

    // Fast forward through retry delay
    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.output).toBe("Success on second attempt");
    expect(executeFn).toHaveBeenCalledTimes(2);
  });

  it("should fail after max retries", async () => {
    const task: TaskRequest = {
      instruction: "Test task",
      options: {
        retry: {
          maxRetries: 1,
          initialDelay: 50,
        },
      },
    };

    const executeFn = vi.fn().mockRejectedValue(new Error("Always fails"));

    const resultPromise = retryHandler.executeWithRetry(task, executeFn);

    // Handle the promise and advance timers
    await Promise.allSettled([
      vi.advanceTimersByTimeAsync(100),
      resultPromise.catch(() => {}), // Catch to prevent unhandled rejection
    ]);

    await expect(resultPromise).rejects.toThrow("Always fails");
    expect(executeFn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });
});
