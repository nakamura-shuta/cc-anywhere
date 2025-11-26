/**
 * Gemini Task Executor Adapter
 *
 * Adapts GeminiAgentExecutor (IAgentExecutor interface) to be compatible
 * with the existing TaskExecutorImpl interface used by TaskQueue
 */

import type { TaskRequest, ClaudeExecutionResult, TaskResponse } from "../claude/types.js";
import type { AgentTaskRequest, AgentExecutionEvent } from "./types.js";
import type { GeminiAgentExecutor as GeminiAgentExecutorType } from "./gemini-agent-executor.js";
import { logger } from "../utils/logger.js";

// Type-only import to avoid loading Gemini SDK at startup
type GeminiAgentExecutor = GeminiAgentExecutorType;

export class GeminiTaskExecutorAdapter {
  private geminiExecutor: GeminiAgentExecutor | null = null;
  private runningTasks: Map<string, AbortController> = new Map();

  /**
   * Lazy-load GeminiAgentExecutor only when needed
   */
  private async getExecutor(): Promise<GeminiAgentExecutor> {
    if (!this.geminiExecutor) {
      logger.debug("Lazy-loading GeminiAgentExecutor");
      const { GeminiAgentExecutor } = await import("./gemini-agent-executor.js");
      this.geminiExecutor = new GeminiAgentExecutor();
    }
    return this.geminiExecutor;
  }

  async execute(
    request: TaskRequest,
    taskId?: string,
    _retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult> {
    const startTime = Date.now();
    const abortController = new AbortController();

    if (taskId) {
      this.runningTasks.set(taskId, abortController);
    }

    try {
      // Pre-check: Verify Gemini API key is configured before execution
      const executor = await this.getExecutor();
      if (!executor.isAvailable()) {
        throw new Error(
          "Gemini API key is not configured. Please set GEMINI_API_KEY environment variable.",
        );
      }
      // Store original onProgress callback
      const originalOnProgress = request.options?.onProgress;

      // Convert TaskRequest to AgentTaskRequest with proper onProgress type
      const agentRequest: AgentTaskRequest = {
        instruction: request.instruction,
        context: request.context,
        options: {
          timeout: request.options?.timeout,
          async: request.options?.async,
          retry: request.options?.retry,
          useWorktree: request.options?.useWorktree,
          worktree: request.options?.worktree,
          allowCrossRepository: request.options?.allowCrossRepository,
          executor: "gemini",
          // Pass through Gemini-specific options
          gemini: request.options?.gemini,
          // Convert onProgress to match AgentExecutionEvent type
          onProgress: originalOnProgress
            ? async (event: AgentExecutionEvent) => {
                await this.handleProgressEvent(event, originalOnProgress);
              }
            : undefined,
        },
      };

      // Collect events from AsyncIterator
      const events: AgentExecutionEvent[] = [];
      const logs: string[] = [];
      let output: any;
      let tokenUsage: { input?: number; output?: number; thought?: number } | undefined;

      // Execute task and collect events (executor already loaded above)
      const iterator = executor.executeTask(agentRequest, {
        taskId,
        abortController,
      });

      // Convert AsyncIterator to AsyncIterable for for-await-of usage
      const iterable = {
        [Symbol.asyncIterator]() {
          return iterator;
        },
      };

      // Process events from async iterator
      for await (const event of iterable) {
        events.push(event);

        // Send progress event to WebSocket if onProgress is provided
        if (originalOnProgress) {
          await this.handleProgressEvent(event, originalOnProgress);
        }

        // Collect data from events
        switch (event.type) {
          case "agent:progress":
            logs.push(event.message);
            break;
          case "agent:response":
            logs.push(event.text);
            break;
          case "agent:completed":
            output = event.output;
            break;
          case "agent:statistics":
            // Collect token usage from statistics event
            if (event.tokenUsage) {
              tokenUsage = {
                input: event.tokenUsage.input,
                output: event.tokenUsage.output,
              };
            }
            break;
          case "agent:failed":
            throw event.error;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        output,
        logs,
        duration,
        tokenUsage,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Gemini task execution failed", { error, taskId });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        logs: [],
        duration,
      };
    } finally {
      if (taskId) {
        this.runningTasks.delete(taskId);
      }
    }
  }

  async cancel(taskId: string): Promise<void> {
    const abortController = this.runningTasks.get(taskId);
    if (abortController) {
      abortController.abort();
      this.runningTasks.delete(taskId);
      logger.info("Gemini task cancelled", { taskId });
    }
  }

  private async handleProgressEvent(
    event: AgentExecutionEvent,
    onProgress: (progress: any) => void | Promise<void>,
  ): Promise<void> {
    try {
      switch (event.type) {
        case "agent:start":
          await onProgress({
            type: "progress",
            message: "Task started",
            data: {
              status: "started",
              executor: event.executor,
            },
          });
          break;
        case "agent:progress":
          await onProgress({
            type: "log",
            message: event.message,
            data: event.data,
          });
          break;
        case "agent:response":
          await onProgress({
            type: "gemini:response",
            message: event.text,
            data: {},
          });
          break;
        case "agent:statistics":
          await onProgress({
            type: "statistics",
            message: "Task statistics",
            data: {
              totalTurns: event.totalTurns,
              totalToolCalls: event.totalToolCalls,
              toolStats: event.toolStats,
              tokenUsage: event.tokenUsage,
            },
          });
          break;
        case "agent:completed":
          await onProgress({
            type: "summary",
            message: "Task completed",
            data: {
              output: event.output,
              duration: event.duration,
            },
          });
          break;
        case "agent:failed":
          await onProgress({
            type: "log",
            message: `Task failed: ${event.error.message}`,
            data: {
              error: event.error.message,
              level: "error",
            },
          });
          break;
      }
    } catch (error) {
      logger.error("Error handling progress event", { error, eventType: event.type });
    }
  }
}
