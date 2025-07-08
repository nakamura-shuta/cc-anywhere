import type { TaskRequest, RetryOptions, ClaudeExecutionResult } from "../claude/types.js";
import { RetryPolicy } from "../claude/types.js";
import { logger } from "../utils/logger.js";

export interface RetryHandlerOptions {
  onRetryAttempt?: (attempt: number, error: Error, delay: number) => void | Promise<void>;
}

export class RetryHandler {
  async executeWithRetry(
    taskRequest: TaskRequest,
    executeFn: () => Promise<ClaudeExecutionResult>,
    options?: RetryHandlerOptions,
  ): Promise<ClaudeExecutionResult> {
    const retryConfig = this.getRetryConfig(taskRequest.options?.retry);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        logger.debug("Executing task attempt", {
          attempt: attempt + 1,
          maxAttempts: retryConfig.maxRetries + 1,
        });
        const result = await executeFn();
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.error("Task attempt failed", {
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        if (attempt === retryConfig.maxRetries) {
          logger.error("Max retries reached, failing task", {
            maxRetries: retryConfig.maxRetries,
          });
          break; // No more retries
        }

        if (!this.shouldRetry(error as Error, retryConfig)) {
          logger.debug("Error not retryable", {
            error: (error as Error).message,
          });
          throw error; // Error not retryable
        }

        const delay = this.calculateDelay(attempt, retryConfig);
        logger.info("Retrying task", {
          delayMs: delay,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
        });

        if (options?.onRetryAttempt) {
          await options.onRetryAttempt(attempt + 1, error as Error, delay);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private getRetryConfig(config?: RetryOptions): Required<RetryOptions> {
    return {
      maxRetries: config?.maxRetries ?? 3,
      initialDelay: config?.initialDelay ?? 1000,
      maxDelay: config?.maxDelay ?? 60000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      retryableErrors: config?.retryableErrors ?? [],
      policy: config?.policy ?? RetryPolicy.EXPONENTIAL,
    };
  }

  private shouldRetry(error: Error, config: Required<RetryOptions>): boolean {
    if (config.policy === RetryPolicy.NONE) {
      return false; // No retry when policy is NONE
    }

    if (config.retryableErrors.length === 0) {
      return true; // Retry all errors if no specific errors defined
    }

    // Check both error message and error code
    return config.retryableErrors.some(
      (retryableError) =>
        error.message.includes(retryableError) || (error as any).code === retryableError,
    );
  }

  private calculateDelay(attempt: number, config: Required<RetryOptions>): number {
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

  calculateNextRetryTime(lastAttempt: number, config?: RetryOptions): Date | undefined {
    const retryConfig = this.getRetryConfig(config);

    if (retryConfig.policy === RetryPolicy.NONE || lastAttempt >= retryConfig.maxRetries) {
      return undefined;
    }

    const delay = this.calculateDelay(lastAttempt, retryConfig);
    return new Date(Date.now() + delay);
  }
}
