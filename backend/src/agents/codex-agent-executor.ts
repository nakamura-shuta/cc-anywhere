/**
 * Codex Agent Executor
 *
 * OpenAI Codex SDK implementation of IAgentExecutor interface
 */

import type { Codex } from "@openai/codex-sdk";
import type {
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
} from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { BaseTaskExecutor } from "./base-task-executor.js";
import { ProgressEventConverter } from "../services/progress-event-converter.js";

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
export class CodexAgentExecutor extends BaseTaskExecutor {
  private codex: Codex | null = null;
  private runningThreads: Map<
    string,
    { thread: any; iterator: AsyncIterator<any>; returnFn?: () => Promise<void> }
  > = new Map();

  constructor() {
    super("codex-task");
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
    const taskId = options.taskId || this.generateTaskId();
    const startTime = Date.now();

    this.logTaskStart(EXECUTOR_TYPES.CODEX, taskId, request.instruction);

    // Emit start event
    yield {
      type: "agent:start",
      executor: EXECUTOR_TYPES.CODEX,
      timestamp: new Date(),
    };

    try {
      const codex = await this.getCodexInstance();
      // Create thread with mandatory sandbox settings
      const codexOptions = request.options?.codex;
      const sandboxMode = codexOptions?.sandboxMode ?? "workspace-write";
      const skipGitRepoCheck = codexOptions?.skipGitRepoCheck ?? true;
      const workingDirectory = request.context?.workingDirectory;

      // Session continuation options
      const continueSession = codexOptions?.continueSession ?? false;
      const resumeThreadId = codexOptions?.resumeSession;

      // Network and search options (Codex SDK v0.57.0+)
      // デフォルト値: webSearch=true, networkAccess=false
      // タスク依頼時に個別指定可能
      const networkAccess = codexOptions?.networkAccess ?? false;
      const webSearch = codexOptions?.webSearch ?? true;

      const threadOptions = {
        skipGitRepoCheck,
        sandboxMode,
        workingDirectory,
        networkAccessEnabled: networkAccess,
        webSearchEnabled: webSearch,
      };

      logger.debug("Codex thread options", {
        taskId,
        networkAccessEnabled: networkAccess,
        webSearchEnabled: webSearch,
        sandboxMode,
      });

      // Create or resume thread
      let thread;
      let shouldFallbackToNew = false;

      if (continueSession && resumeThreadId) {
        logger.debug("Resuming Codex thread", {
          threadId: resumeThreadId,
          taskId,
          ...threadOptions,
        });

        try {
          thread = codex.resumeThread(resumeThreadId, threadOptions);
        } catch (error) {
          logger.warn("Failed to resume thread, falling back to new thread", {
            threadId: resumeThreadId,
            taskId,
            error: error instanceof Error ? error.message : String(error),
          });
          shouldFallbackToNew = true;
        }
      }

      if (!thread || shouldFallbackToNew) {
        logger.debug("Starting new Codex thread", {
          taskId,
          ...threadOptions,
        });
        thread = codex.startThread(threadOptions);
      }

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
      // Initialize threadId with resumeThreadId if resuming (thread.started may not fire)
      let threadId: string | undefined = resumeThreadId;

      // Process events and convert to unified format
      try {
        for await (const event of iterator) {
          logger.debug("Received Codex event", { type: event.type, taskId });

          // Capture thread ID from thread.started event
          if (event.type === "thread.started") {
            threadId = event.thread_id;
            logger.debug("Thread ID captured from event", { threadId, taskId });
          }

          // Collect agent message text for final output
          if (event.type === "item.completed" && event.item.type === "agent_message") {
            agentResponses.push(event.item.text);
          }

          // Convert Codex event to AgentExecutionEvent
          const agentEvent = ProgressEventConverter.convertCodexEvent(event);
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

      // Fallback: Use thread.id if threadId is still undefined
      const finalThreadId = threadId || (thread as any)?.id;

      this.logTaskComplete(taskId, duration);
      logger.debug("Codex task completed with thread ID", {
        responseCount: agentResponses.length,
        threadId: finalThreadId,
        fromEvent: !!threadId,
        fromThreadObject: !threadId && !!(thread as any)?.id,
      });

      yield {
        type: "agent:completed",
        output,
        sessionId: finalThreadId, // Include thread ID for session continuation
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logTaskFailure(taskId, error);

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
}
