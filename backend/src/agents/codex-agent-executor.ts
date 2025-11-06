/**
 * Codex Agent Executor
 *
 * OpenAI Codex SDK implementation of IAgentExecutor interface
 */

import type { Codex } from "@openai/codex-sdk";
import type {
  IAgentExecutor,
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
} from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { BaseExecutorHelper } from "./base-executor-helper.js";

/**
 * Lazy-load Codex SDK module
 * tsx v4.20+ supports ESM dynamic import natively
 */
interface CodexModule {
  Codex: typeof Codex;
}

let codexModulePromise: Promise<CodexModule> | null = null;

async function loadCodexModule(): Promise<CodexModule> {
  if (!codexModulePromise) {
    codexModulePromise = import("@openai/codex-sdk") as Promise<CodexModule>;
  }
  return codexModulePromise;
}

/**
 * Codex SDK executor implementation
 * Phase 0の検証結果に基づく実装
 */
export class CodexAgentExecutor implements IAgentExecutor {
  private codex: Codex | null = null;
  private helper = new BaseExecutorHelper("codex-task");
  private runningThreads: Map<
    string,
    { thread: any; iterator: AsyncIterator<any>; returnFn?: () => Promise<void> }
  > = new Map();

  constructor() {
    // Codex SDKはESM専用のため、実体は初回利用時に動的ロードする
  }

  private async getCodexInstance(): Promise<Codex> {
    if (!this.codex) {
      const { Codex: CodexCtor } = await loadCodexModule();
      this.codex = new CodexCtor();
      logger.debug("CodexAgentExecutor initialized");
    }
    return this.codex;
  }

  async *executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncIterator<AgentExecutionEvent> {
    const taskId = options.taskId || this.helper.generateTaskId();
    const startTime = Date.now();

    logger.debug("Starting Codex task execution", { taskId, instruction: request.instruction });

    // Emit start event
    yield {
      type: "agent:start",
      executor: EXECUTOR_TYPES.CODEX,
      timestamp: new Date(),
    };

    try {
      const codex = await this.getCodexInstance();
      // Create thread with mandatory sandbox settings
      const sandboxMode = request.options?.codex?.sandboxMode ?? "workspace-write";
      const skipGitRepoCheck = request.options?.codex?.skipGitRepoCheck ?? true;
      const workingDirectory = request.context?.workingDirectory;

      logger.debug("Creating Codex thread", {
        sandboxMode,
        skipGitRepoCheck,
        workingDirectory,
      });

      const thread = codex.startThread({
        skipGitRepoCheck,
        sandboxMode,
        workingDirectory,
      });

      // Execute with streaming (Phase 0: ストリーミングモードのみ使用)
      logger.debug("Starting streamed execution", { instruction: request.instruction });

      const { events } = await thread.runStreamed(request.instruction);

      // Track thread for cancellation
      const iterator = events[Symbol.asyncIterator]();

      // Create return function for cleanup
      const returnFn = async () => {
        logger.debug("Closing Codex event stream", { taskId });
        await iterator.return?.(undefined);
      };

      this.runningThreads.set(taskId, { thread, iterator, returnFn });

      // Collect agent responses to build final output
      const agentResponses: string[] = [];

      // Process events and convert to unified format
      try {
        for await (const event of iterator) {
          logger.debug("Received Codex event", { type: event.type, taskId });

          // Collect agent message text for final output
          if (event.type === "item.completed" && event.item.type === "agent_message") {
            agentResponses.push(event.item.text);
          }

          // Convert Codex event to AgentExecutionEvent
          const agentEvent = this.convertCodexEvent(event);
          if (agentEvent) {
            yield agentEvent;
          }

          // Handle turn completion - 必須: iterator.return() を呼び出す (Phase 0検証結果)
          if (event.type === "turn.completed" || event.type === "turn.failed") {
            logger.debug("Turn completed/failed, closing stream", { type: event.type, taskId });
            await iterator.return?.(undefined);
            break;
          }

          // Check for cancellation
          if (options.abortController?.signal.aborted) {
            logger.debug("Task cancelled by abort signal", { taskId });
            await iterator.return?.(undefined);
            throw new Error("Task cancelled");
          }
        }
      } finally {
        // Cleanup
        this.runningThreads.delete(taskId);
      }

      // Emit completion event
      const duration = Date.now() - startTime;
      const output = agentResponses.length > 0 ? agentResponses.join("\n\n") : "Task completed";

      logger.debug("Codex task completed", {
        taskId,
        duration,
        responseCount: agentResponses.length,
      });

      yield {
        type: "agent:completed",
        output,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Codex task failed", { taskId, duration, error });

      yield {
        type: "agent:failed",
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      };
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    logger.debug("Cancelling Codex task", { taskId });

    const threadInfo = this.runningThreads.get(taskId);
    if (threadInfo) {
      try {
        // Codex SDK のキャンセル方法: iterator.return() を呼び出す
        if (threadInfo.returnFn) {
          await threadInfo.returnFn();
        } else {
          await threadInfo.iterator.return?.(undefined);
        }
        this.runningThreads.delete(taskId);
        logger.debug("Codex task cancelled successfully", { taskId });
      } catch (error) {
        logger.error("Error cancelling Codex task", { taskId, error });
      }
    } else {
      logger.debug("Task not found for cancellation", { taskId });
    }
  }

  getExecutorType(): ExecutorType {
    return EXECUTOR_TYPES.CODEX;
  }

  isAvailable(): boolean {
    // Check if OpenAI API key is configured
    return !!config.openai.apiKey;
  }

  /**
   * Codex イベントを AgentExecutionEvent に変換
   * Phase 0検証結果に基づくイベント変換
   */
  private convertCodexEvent(codexEvent: any): AgentExecutionEvent | null {
    switch (codexEvent.type) {
      case "thread.started":
        return {
          type: "agent:progress",
          message: "Thread started",
          timestamp: new Date(),
        };

      case "turn.started":
        return {
          type: "agent:progress",
          message: "Turn started",
          timestamp: new Date(),
        };

      case "item.started":
        if (codexEvent.item.type === "command_execution") {
          return {
            type: "agent:tool:start",
            tool: "Bash",
            toolId: codexEvent.item.id,
            input: { command: codexEvent.item.command },
            timestamp: new Date(),
          };
        }
        break;

      case "item.completed":
        if (codexEvent.item.type === "command_execution") {
          return {
            type: "agent:tool:end",
            tool: "Bash",
            toolId: codexEvent.item.id,
            output: codexEvent.item.aggregated_output,
            success: codexEvent.item.exit_code === 0,
            duration: 0, // TODO: Calculate duration
            timestamp: new Date(),
          };
        } else if (codexEvent.item.type === "agent_message") {
          return {
            type: "agent:response",
            text: codexEvent.item.text,
            timestamp: new Date(),
          };
        }
        break;

      case "turn.completed":
        return {
          type: "agent:statistics",
          totalTurns: 1, // TODO: Track turn count
          totalToolCalls: 0, // TODO: Track tool calls
          toolStats: {},
          elapsedTime: 0,
          tokenUsage: codexEvent.usage
            ? {
                input: codexEvent.usage.input_tokens || 0,
                output: codexEvent.usage.output_tokens || 0,
                cached: codexEvent.usage.cached_input_tokens || 0,
              }
            : undefined,
          timestamp: new Date(),
        };

      case "turn.failed":
        logger.warn("Turn failed", { error: codexEvent.error });
        return {
          type: "agent:progress",
          message: `Turn failed: ${codexEvent.error || "Unknown error"}`,
          timestamp: new Date(),
        };
    }

    return null;
  }
}
