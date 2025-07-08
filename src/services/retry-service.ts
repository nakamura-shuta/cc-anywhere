import { logger } from "../utils/logger";
import type { RetryOptions, RetryAttempt, TaskResponse } from "../claude/types";
import { RetryPolicy } from "../claude/types";

export class RetryService {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_INITIAL_DELAY = 1000; // 1 second
  private static readonly DEFAULT_MAX_DELAY = 60000; // 60 seconds
  private static readonly DEFAULT_BACKOFF_MULTIPLIER = 2;

  /**
   * Calculate the delay for the next retry attempt
   */
  static calculateRetryDelay(currentAttempt: number, config: RetryOptions = {}): number {
    const policy = config.policy || RetryPolicy.EXPONENTIAL;
    const initialDelay = config.initialDelay || this.DEFAULT_INITIAL_DELAY;
    const maxDelay = config.maxDelay || this.DEFAULT_MAX_DELAY;
    const multiplier = config.backoffMultiplier || this.DEFAULT_BACKOFF_MULTIPLIER;

    let delay: number;

    switch (policy) {
      case RetryPolicy.NONE:
        return 0;

      case RetryPolicy.LINEAR:
        delay = initialDelay * currentAttempt;
        break;

      case RetryPolicy.EXPONENTIAL:
        delay = initialDelay * Math.pow(multiplier, currentAttempt - 1);
        break;

      default:
        delay = initialDelay;
    }

    // Apply jitter (±10%) to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    delay += jitter;

    // Cap at max delay
    return Math.min(Math.round(delay), maxDelay);
  }

  /**
   * Check if an error is retryable based on configuration
   */
  static isRetryableError(
    error: Error | { message: string; code?: string },
    config: RetryOptions = {},
  ): boolean {
    // If no specific retryable errors configured, retry all errors
    if (!config.retryableErrors || config.retryableErrors.length === 0) {
      return true;
    }

    const errorMessage = error.message.toLowerCase();
    const errorCode = "code" in error ? error.code : undefined;

    // Check if error message or code matches any retryable pattern
    return config.retryableErrors.some((pattern: string) => {
      const patternLower = pattern.toLowerCase();
      return (
        errorMessage.includes(patternLower) ||
        (errorCode && errorCode.toLowerCase() === patternLower)
      );
    });
  }

  /**
   * Check if task should be retried
   */
  static shouldRetry(
    currentAttempt: number,
    error: Error | { message: string; code?: string },
    config: RetryOptions = {},
  ): boolean {
    const maxRetries = config.maxRetries ?? this.DEFAULT_MAX_RETRIES;

    // Check if we've exceeded max retries
    if (currentAttempt >= maxRetries) {
      logger.info("Max retries reached", { currentAttempt, maxRetries });
      return false;
    }

    // Check if error is retryable
    if (!this.isRetryableError(error, config)) {
      logger.info("Error is not retryable", {
        error: error.message,
        retryableErrors: config.retryableErrors,
      });
      return false;
    }

    return true;
  }

  /**
   * Create retry metadata for a new task
   */
  static createInitialRetryMetadata(config: RetryOptions = {}): TaskResponse["retryMetadata"] {
    const maxRetries = config.maxRetries ?? this.DEFAULT_MAX_RETRIES;

    return {
      currentAttempt: 0,
      maxRetries,
      retryHistory: [],
    };
  }

  /**
   * Update retry metadata after a failed attempt
   */
  static updateRetryMetadata(
    currentMetadata: TaskResponse["retryMetadata"],
    error: { message: string; code?: string },
    startedAt: Date,
    completedAt: Date,
    config: RetryOptions = {},
  ): NonNullable<TaskResponse["retryMetadata"]> {
    const metadata = currentMetadata ?? this.createInitialRetryMetadata(config);

    // TypeScript safety check
    if (!metadata) {
      throw new Error("Failed to initialize retry metadata");
    }

    const newAttempt = metadata.currentAttempt + 1;
    const delay = this.calculateRetryDelay(newAttempt, config);

    const retryAttempt: RetryAttempt = {
      attemptNumber: metadata.currentAttempt,
      startedAt,
      completedAt,
      error,
      delay: metadata.currentAttempt > 0 ? delay : undefined,
    };

    const nextRetryAt = delay > 0 ? new Date(Date.now() + delay) : undefined;

    return {
      currentAttempt: newAttempt,
      maxRetries: metadata.maxRetries,
      retryHistory: [...metadata.retryHistory, retryAttempt],
      nextRetryAt,
    };
  }

  /**
   * Get retry configuration from task options
   */
  static getRetryOptions(options?: { retry?: RetryOptions }): RetryOptions {
    // If no retry config provided, return config with maxRetries = 0
    if (!options?.retry) {
      return { maxRetries: 0 };
    }
    return options.retry;
  }

  /**
   * Log retry attempt
   */
  static logRetryAttempt(
    taskId: string,
    currentAttempt: number,
    maxRetries: number,
    delay: number,
    error: { message: string; code?: string },
  ): void {
    logger.info("Scheduling task retry", {
      taskId,
      currentAttempt,
      maxRetries,
      remainingRetries: maxRetries - currentAttempt,
      delayMs: delay,
      error: error.message,
      errorCode: error.code,
    });
  }
}
