/**
 * Codex Task Executor Adapter
 *
 * Adapts CodexAgentExecutor (IAgentExecutor interface) to be compatible
 * with the existing TaskExecutorImpl interface used by TaskQueue
 */

import type { TaskRequest, ClaudeExecutionResult, TaskResponse } from "../claude/types.js";
import type { AgentTaskRequest, AgentExecutionEvent } from "./types.js";
import type { CodexAgentExecutor as CodexAgentExecutorType } from "./codex-agent-executor.js";
import { logger } from "../utils/logger.js";

// Type-only import to avoid loading Codex SDK at startup
type CodexAgentExecutor = CodexAgentExecutorType;

export class CodexTaskExecutorAdapter {
  private codexExecutor: CodexAgentExecutor | null = null;
  private runningTasks: Map<string, AbortController> = new Map();

  /**
   * Lazy-load CodexAgentExecutor only when needed
   */
  private async getExecutor(): Promise<CodexAgentExecutor> {
    if (!this.codexExecutor) {
      logger.debug("Lazy-loading CodexAgentExecutor");
      const { CodexAgentExecutor } = await import("./codex-agent-executor.js");
      this.codexExecutor = new CodexAgentExecutor();
    }
    return this.codexExecutor;
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
          executor: "codex",
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
      let conversationHistory: any[] | undefined;
      let sessionId: string | undefined;
      let todos: any[] | undefined;

      // Execute task and collect events (lazy-load executor)
      const executor = await this.getExecutor();
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
          case "agent:tool:start":
            logs.push(`${event.tool}: Starting...`);
            break;
          case "agent:tool:end":
            logs.push(`${event.tool}: ${event.success ? "Success" : "Failed"}`);
            break;
          case "agent:completed":
            output = event.output;
            sessionId = event.sessionId;
            conversationHistory = event.conversationHistory;
            todos = event.todos;
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
        conversationHistory,
        sdkSessionId: sessionId,
        todos,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Codex task execution failed", { error, taskId });

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
      logger.info("Codex task cancelled", { taskId });
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
            type: "claude:response",
            message: event.text,
            data: {
              turnNumber: event.turnNumber,
            },
          });
          break;
        case "agent:tool:start":
          await onProgress({
            type: "tool:start",
            message: `Tool ${event.tool} started`,
            data: {
              tool: event.tool,
              toolId: event.toolId,
              input: event.input,
            },
          });
          break;
        case "agent:tool:end":
          await onProgress({
            type: "tool:end",
            message: `Tool ${event.tool} ${event.success ? "completed" : "failed"}`,
            data: {
              tool: event.tool,
              toolId: event.toolId,
              output: event.output,
              error: event.error,
              duration: event.duration,
              success: event.success,
            },
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
              sessionId: event.sessionId,
              conversationHistory: event.conversationHistory,
              todos: event.todos,
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
