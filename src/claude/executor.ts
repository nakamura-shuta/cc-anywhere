import { ClaudeClient } from "./client";
import { ClaudeCodeClient } from "./claude-code-client";
import type { TaskRequest, TaskExecutor, ClaudeExecutionResult, TaskResponse } from "./types";
import { logger } from "../utils/logger";
import { config } from "../config";
import { existsSync } from "fs";
import { resolve } from "path";
import { RetryHandler, type RetryHandlerOptions } from "../services/retry-handler";
import { TimeoutManager } from "../services/timeout-manager";
import { TimeoutPhase, TimeoutError, type TimeoutConfig } from "../types/timeout";

export class TaskExecutorImpl implements TaskExecutor {
  private client: ClaudeClient;
  private codeClient: ClaudeCodeClient;
  private useClaudeCode: boolean;
  private runningTasks: Map<string, AbortController> = new Map();
  private retryHandler: RetryHandler;

  constructor(useClaudeCode = true) {
    this.client = new ClaudeClient();
    this.codeClient = new ClaudeCodeClient();
    this.useClaudeCode = useClaudeCode;
    this.retryHandler = new RetryHandler();
  }

  async execute(
    task: TaskRequest,
    taskId?: string,
    retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult> {
    // If retry is configured, use retry handler
    if (task.options?.retry && (!retryMetadata || retryMetadata.currentAttempt === 0)) {
      const retryOptions: RetryHandlerOptions = {
        onRetryAttempt: async (attempt, error, delay) => {
          // Update retry metadata in database or queue
          logger.info(`Scheduling retry attempt ${attempt} after ${delay}ms`, {
            taskId,
            error: error.message,
          });
        },
      };

      return this.retryHandler.executeWithRetry(
        task,
        () => this.executeCore(task, taskId, retryMetadata),
        retryOptions,
      );
    }

    // Otherwise, execute directly
    return this.executeCore(task, taskId, retryMetadata);
  }

  private async executeCore(
    task: TaskRequest,
    taskId?: string,
    retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    logs.push(`Task started: ${task.instruction}`);

    // Log retry information if this is a retry attempt
    if (retryMetadata && retryMetadata.currentAttempt > 0) {
      logs.push(`Retry attempt ${retryMetadata.currentAttempt} of ${retryMetadata.maxRetries}`);
    }
    logger.info("Executing task", { instruction: task.instruction, taskId });

    // Create AbortController for this task
    const abortController = new AbortController();

    // Register the task if taskId is provided
    if (taskId) {
      this.runningTasks.set(taskId, abortController);
    }

    // Set up timeout configuration
    let timeoutConfig: TimeoutConfig;
    if (typeof task.options?.timeout === "number") {
      // Legacy number timeout - use as total timeout
      timeoutConfig = { total: task.options.timeout };
    } else if (task.options?.timeout && typeof task.options.timeout === "object") {
      timeoutConfig = task.options.timeout;
    } else {
      timeoutConfig = { total: config.tasks.defaultTimeout };
    }

    // Create timeout manager
    const timeoutManager = new TimeoutManager(
      timeoutConfig,
      (warning) => {
        const message = `Task timeout warning: ${warning.remaining}ms remaining in ${warning.phase} phase`;
        logs.push(message);
        logger.warn(message, { taskId, warning });
      },
      (error) => {
        logs.push(`Task timed out: ${error.message}`);
        logger.error("Task timeout", { taskId, error: error.message });
        abortController.abort();
      },
    );

    try {
      // Build the prompt
      const prompt = this.buildPrompt(task);

      let output: unknown;

      if (this.useClaudeCode) {
        // Use Claude Code SDK
        try {
          // Transition to setup phase
          timeoutManager.transitionToPhase(TimeoutPhase.SETUP);

          // Notify progress: Starting task
          if (task.options?.onProgress) {
            await task.options.onProgress({
              type: "log",
              message: "タスク実行を開始します...",
            });
          }

          // Validate and set working directory if specified
          let workingDirectory: string | undefined;
          if (task.context?.workingDirectory) {
            workingDirectory = resolve(task.context.workingDirectory);

            // Check if directory exists
            if (!existsSync(workingDirectory)) {
              throw new Error(`Working directory does not exist: ${workingDirectory}`);
            }

            logs.push(`Working directory: ${workingDirectory}`);
            logger.info("Using working directory", { cwd: workingDirectory });

            if (task.options?.onProgress) {
              await task.options.onProgress({
                type: "log",
                message: `作業ディレクトリ: ${workingDirectory}`,
              });
            }
          }

          // Transition to execution phase
          timeoutManager.transitionToPhase(TimeoutPhase.EXECUTION);

          // Notify progress: Execution phase
          if (task.options?.onProgress) {
            await task.options.onProgress({
              type: "log",
              message: "Claude Codeを実行中...",
            });
          }

          const result = await this.codeClient.executeTask(prompt, {
            maxTurns: 5,
            cwd: workingDirectory,
            abortController,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            allowedTools: task.options?.allowedTools,
            onProgress: task.options?.onProgress,
          });

          if (!result.success) {
            throw result.error || new Error("Task execution failed");
          }

          output = this.codeClient.formatMessagesAsString(result.messages);
          logs.push(`Received ${result.messages.length} messages from Claude Code`);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Check if this was a cancellation or timeout
            const wasCancelled = taskId && !this.runningTasks.has(taskId);
            if (wasCancelled) {
              throw new Error("Task was cancelled");
            }
            // TimeoutManager already logged the timeout details
            throw error instanceof TimeoutError ? error : new Error("Task execution timed out");
          }
          throw error;
        }
      } else {
        // Use regular Claude API
        const systemPrompt = this.getSystemPrompt();

        try {
          // Transition to execution phase (no setup needed for regular API)
          timeoutManager.transitionToPhase(TimeoutPhase.EXECUTION);

          // Execute with abort signal
          output = await this.executeWithAbortSignal(
            () => this.client.sendMessage(prompt, systemPrompt),
            abortController.signal,
          );
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Check if this was a cancellation or timeout
            const wasCancelled = taskId && !this.runningTasks.has(taskId);
            if (wasCancelled) {
              throw new Error("Task was cancelled");
            }
            // TimeoutManager already logged the timeout details
            throw error instanceof TimeoutError ? error : new Error("Task execution timed out");
          }
          throw error;
        }
      }

      // Transition to cleanup phase
      timeoutManager.transitionToPhase(TimeoutPhase.CLEANUP);

      // Notify progress: Completion
      if (task.options?.onProgress) {
        await task.options.onProgress({
          type: "log",
          message: "タスクが正常に完了しました",
        });
      }

      logs.push("Task completed successfully");
      logger.info("Task completed", {
        instruction: task.instruction,
        duration: Date.now() - startTime,
        usedClaudeCode: this.useClaudeCode,
      });

      // Clean up
      timeoutManager.dispose();
      if (taskId) {
        this.runningTasks.delete(taskId);
      }

      return {
        success: true,
        output,
        logs,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logs.push(`Task failed: ${errorMessage}`);

      logger.error("Task execution failed", {
        instruction: task.instruction,
        error,
        duration: Date.now() - startTime,
      });

      // Clean up
      timeoutManager.dispose();
      if (taskId) {
        this.runningTasks.delete(taskId);
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
        logs,
        duration: Date.now() - startTime,
      };
    }
  }

  async cancel(taskId: string): Promise<void> {
    logger.info("Task cancellation requested", { taskId });

    const abortController = this.runningTasks.get(taskId);
    if (abortController) {
      // Abort the task execution
      abortController.abort();

      // Remove from running tasks map
      this.runningTasks.delete(taskId);

      logger.info("Task cancelled successfully", { taskId });
    } else {
      logger.warn("Task not found in running tasks", { taskId });
    }
  }

  private async executeWithAbortSignal<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
    // Handle abort signal
    const abortError = new Error("Task execution aborted");
    abortError.name = "AbortError";

    const abortHandler = () => {
      throw abortError;
    };

    if (signal.aborted) {
      abortHandler();
    }

    signal.addEventListener("abort", abortHandler);

    try {
      const result = await fn();
      signal.removeEventListener("abort", abortHandler);
      return result;
    } catch (error) {
      signal.removeEventListener("abort", abortHandler);
      throw error;
    }
  }

  private buildPrompt(task: TaskRequest): string {
    let prompt = task.instruction;

    // Claude Code SDKはcwdオプションで作業ディレクトリを自動的に設定するため、
    // 通常のClaude APIの場合のみコンテキストに追加
    if (!this.useClaudeCode && task.context) {
      prompt += "\n\nContext:";

      if (task.context.workingDirectory) {
        prompt += `\nWorking directory: ${task.context.workingDirectory}`;
      }

      if (task.context.files && task.context.files.length > 0) {
        prompt += `\nFiles: ${task.context.files.join(", ")}`;
      }
    }

    return prompt;
  }

  private getSystemPrompt(): string {
    return `You are a helpful AI assistant integrated into a development environment. 
You help users with various programming and development tasks. 
Provide clear, concise, and accurate responses. 
When providing code, ensure it follows best practices and is well-documented.`;
  }
}
