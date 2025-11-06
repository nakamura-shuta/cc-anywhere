/**
 * Claude Agent Executor
 *
 * Claude Agent SDK implementation of IAgentExecutor interface
 */

import type {
  IAgentExecutor,
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
  AgentProgressEvent,
  AgentToolStartEvent,
  AgentToolEndEvent,
  AgentResponseEvent,
  AgentStatisticsEvent,
} from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import { getSharedClaudeClient } from "../claude/shared-instance.js";
import type { ClaudeCodeClient } from "../claude/claude-code-client.js";
import { BaseExecutorHelper } from "./base-executor-helper.js";

/**
 * Claude Agent SDK executor implementation
 */
export class ClaudeAgentExecutor implements IAgentExecutor {
  private codeClient: ClaudeCodeClient;
  private helper = new BaseExecutorHelper("task");

  constructor() {
    this.codeClient = getSharedClaudeClient();
    logger.debug("ClaudeAgentExecutor initialized");
  }

  async *executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncIterator<AgentExecutionEvent> {
    const taskId = options.taskId || this.helper.generateTaskId();
    const startTime = Date.now();

    logger.debug("Starting Claude task execution", { taskId, instruction: request.instruction });

    // Emit start event
    yield {
      type: "agent:start",
      executor: EXECUTOR_TYPES.CLAUDE,
      timestamp: new Date(),
    };

    // Create AbortController for this task
    const abortController = options.abortController || new AbortController();

    // Track the task for cancellation
    this.helper.trackTask(taskId, abortController);

    try {
      // Build prompt
      const prompt = this.buildPrompt(request);

      // Prepare progress callback that converts to AgentExecutionEvent
      const progressEvents: AgentExecutionEvent[] = [];
      const onProgress = async (progress: { type: string; message: string; data?: any }) => {
        const event = this.convertProgressToEvent(progress);
        if (event) {
          progressEvents.push(event);
        }

        // Call original progress callback if provided
        if (request.options?.onProgress) {
          // onProgress expects AgentExecutionEvent, so we need to convert it
          const agentEvent =
            event ||
            ({
              type: "agent:progress",
              message: progress.message,
              timestamp: new Date(),
            } as AgentExecutionEvent);
          await request.options?.onProgress(agentEvent);
        }
      };

      // Resolve working directory
      const workingDirectory = request.context?.workingDirectory;

      // Prepare SDK options
      const sdkOptions = this.prepareSDKOptions(request, abortController, onProgress);

      // Execute task via Claude Code SDK
      logger.debug("Executing task via Claude Code SDK", {
        taskId,
        cwd: workingDirectory,
        options: sdkOptions,
      });

      const result = await this.codeClient.executeTask(prompt, {
        ...sdkOptions,
        cwd: workingDirectory,
      });

      // Yield all accumulated progress events
      for (const event of progressEvents) {
        yield event;
      }

      // Calculate duration
      const duration = Date.now() - startTime;

      // Get todos from tracker if available
      const todos = result.tracker?.getTodos();

      // Emit completed event
      yield {
        type: "agent:completed",
        output: result.messages, // SDK returns messages array
        sessionId: result.sessionId,
        conversationHistory: result.messages,
        todos,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error("Claude task execution failed", { taskId, error });

      // Emit failed event
      yield {
        type: "agent:failed",
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      };
    } finally {
      // Cleanup
      this.helper.untrackTask(taskId);
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.helper.cancelTrackedTask(taskId);
  }

  getExecutorType(): ExecutorType {
    return EXECUTOR_TYPES.CLAUDE;
  }

  isAvailable(): boolean {
    // Check if Claude API key is configured
    return !!config.claude.apiKey;
  }

  /**
   * Build prompt from request
   */
  private buildPrompt(request: AgentTaskRequest): string {
    let prompt = request.instruction;

    // Add context if provided
    if (request.context?.additionalContext) {
      prompt = `${request.context.additionalContext}\n\n${prompt}`;
    }

    return prompt;
  }

  /**
   * Prepare SDK options from request
   */
  private prepareSDKOptions(
    request: AgentTaskRequest,
    abortController: AbortController,
    onProgress: (progress: any) => Promise<void>,
  ): any {
    const claudeOptions = request.options?.claude || {};

    return {
      maxTurns: claudeOptions.maxTurns,
      allowedTools: claudeOptions.allowedTools,
      disallowedTools: claudeOptions.disallowedTools,
      systemPrompt: claudeOptions.systemPrompt,
      permissionMode: claudeOptions.permissionMode,
      executable: claudeOptions.executable,
      executableArgs: claudeOptions.executableArgs,
      mcpConfig: claudeOptions.mcpConfig,
      continueSession: claudeOptions.continueSession,
      resumeSession: claudeOptions.resumeSession,
      outputFormat: claudeOptions.outputFormat,
      verbose: claudeOptions.verbose,
      enableWebSearch: claudeOptions.enableWebSearch,
      abortController,
      onProgress,
    };
  }

  /**
   * Convert Claude SDK progress event to AgentExecutionEvent
   */
  private convertProgressToEvent(progress: {
    type: string;
    message: string;
    data?: any;
  }): AgentExecutionEvent | null {
    switch (progress.type) {
      case "log":
        return {
          type: "agent:progress",
          message: progress.message,
          timestamp: new Date(),
        } as AgentProgressEvent;

      case "progress":
        return {
          type: "agent:progress",
          message: progress.message,
          data: progress.data,
          timestamp: new Date(),
        } as AgentProgressEvent;

      case "tool:start":
        return {
          type: "agent:tool:start",
          tool: progress.data?.tool || "unknown",
          toolId: progress.data?.toolId,
          input: progress.data?.input,
          timestamp: new Date(),
        } as AgentToolStartEvent;

      case "tool:end":
        return {
          type: "agent:tool:end",
          tool: progress.data?.tool || "unknown",
          toolId: progress.data?.toolId,
          output: progress.data?.output,
          error: progress.data?.error,
          duration: progress.data?.duration,
          success: !progress.data?.error,
          timestamp: new Date(),
        } as AgentToolEndEvent;

      case "claude:response":
        return {
          type: "agent:response",
          text: progress.message || progress.data?.text || "",
          turnNumber: progress.data?.turnNumber,
          timestamp: new Date(),
        } as AgentResponseEvent;

      case "statistics":
        return {
          type: "agent:statistics",
          totalTurns: progress.data?.totalTurns || 0,
          totalToolCalls: progress.data?.totalToolCalls || 0,
          toolStats: progress.data?.toolStats || {},
          elapsedTime: progress.data?.elapsedTime || 0,
          tokenUsage: progress.data?.tokenUsage,
          timestamp: new Date(),
        } as AgentStatisticsEvent;

      case "todo_update":
      case "tool_usage":
      case "summary":
        // These event types are Claude-specific and don't map directly
        // They can be logged but not converted to standard AgentExecutionEvent
        return {
          type: "agent:progress",
          message: progress.message,
          data: progress.data,
          timestamp: new Date(),
        } as AgentProgressEvent;

      default:
        // Unknown event type - treat as progress
        logger.debug("Unknown progress event type", { type: progress.type });
        return {
          type: "agent:progress",
          message: progress.message,
          timestamp: new Date(),
        } as AgentProgressEvent;
    }
  }
}
