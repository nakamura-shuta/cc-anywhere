/**
 * Base Task Executor
 *
 * Abstract base class providing common functionality for task executors.
 * Consolidates shared logic like task tracking, cancellation, and helper methods.
 */

import type {
  IAgentExecutor,
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
} from "./types.js";
import { BaseExecutorHelper } from "./base-executor-helper.js";
import { logger } from "../utils/logger.js";

/**
 * Abstract base class for task executors
 * Provides common functionality while allowing executor-specific implementations
 */
export abstract class BaseTaskExecutor implements IAgentExecutor {
  protected helper: BaseExecutorHelper;

  constructor(helperPrefix: string) {
    this.helper = new BaseExecutorHelper(helperPrefix);
  }

  /**
   * Execute a task - implemented by subclasses
   */
  abstract executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncIterator<AgentExecutionEvent>;

  /**
   * Cancel a running task
   * Common implementation using BaseExecutorHelper
   */
  async cancelTask(taskId: string): Promise<void> {
    await this.helper.cancelTrackedTask(taskId);
  }

  /**
   * Get executor type - implemented by subclasses
   */
  abstract getExecutorType(): ExecutorType;

  /**
   * Check if executor is available - implemented by subclasses
   */
  abstract isAvailable(): boolean;

  /**
   * Generate a unique task ID
   * Utility method for subclasses
   */
  protected generateTaskId(): string {
    return this.helper.generateTaskId();
  }

  /**
   * Track a task for cancellation
   * Utility method for subclasses
   */
  protected trackTask(taskId: string, abortController: AbortController): void {
    this.helper.trackTask(taskId, abortController);
  }

  /**
   * Untrack a completed/failed task
   * Utility method for subclasses
   */
  protected untrackTask(taskId: string): void {
    this.helper.untrackTask(taskId);
  }

  /**
   * Log task execution start
   * Utility method for subclasses
   */
  protected logTaskStart(
    executorType: ExecutorType,
    taskId: string,
    instruction: string,
  ): void {
    logger.debug(`Starting ${executorType} task execution`, { taskId, instruction });
  }

  /**
   * Log task execution completion
   * Utility method for subclasses
   */
  protected logTaskComplete(taskId: string, duration: number): void {
    logger.debug("Task execution completed", { taskId, duration });
  }

  /**
   * Log task execution failure
   * Utility method for subclasses
   */
  protected logTaskFailure(taskId: string, error: unknown): void {
    logger.error("Task execution failed", { taskId, error });
  }
}
