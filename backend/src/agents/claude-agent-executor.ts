/**
 * Claude Agent Executor
 *
 * Claude Agent SDK implementation of IAgentExecutor interface
 */

import type {
  AgentTaskRequest,
  AgentExecutionOptions,
  AgentExecutionEvent,
  ExecutorType,
} from "./types.js";
import { EXECUTOR_TYPES } from "./types.js";
import { logger } from "../utils/logger.js";
import type { ProgressEvent } from "../types/progress-events.js";
import { config } from "../config/index.js";
import { getSharedClaudeClient } from "../claude/shared-instance.js";
import type { ClaudeCodeClient } from "../claude/claude-code-client.js";
import { BaseTaskExecutor } from "./base-task-executor.js";
import { ProgressEventConverter } from "../services/progress-event-converter.js";

/**
 * Claude Agent SDK executor implementation
 */
export class ClaudeAgentExecutor extends BaseTaskExecutor {
  private codeClient: ClaudeCodeClient;

  constructor() {
    super("task");
    this.codeClient = getSharedClaudeClient();
    logger.debug("ClaudeAgentExecutor initialized");
  }

  async *executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncIterator<AgentExecutionEvent> {
    const taskId = options.taskId || this.generateTaskId();
    const startTime = Date.now();

    this.logTaskStart(EXECUTOR_TYPES.CLAUDE, taskId, request.instruction);

    // Emit start event
    yield {
      type: "agent:start",
      executor: EXECUTOR_TYPES.CLAUDE,
      timestamp: new Date(),
    };

    // Create AbortController for this task
    const abortController = options.abortController || new AbortController();

    // Track the task for cancellation
    this.trackTask(taskId, abortController);

    try {
      // Build prompt
      const prompt = this.buildPrompt(request);

      // Prepare progress callback that converts to AgentExecutionEvent
      const progressEvents: AgentExecutionEvent[] = [];
      const onProgress = async (progress: ProgressEvent) => {
        const event = ProgressEventConverter.convertProgressToEvent(progress);
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

      this.logTaskComplete(taskId, duration);

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
      this.logTaskFailure(taskId, error);

      // Emit failed event
      yield {
        type: "agent:failed",
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date(),
      };
    } finally {
      // Cleanup
      this.untrackTask(taskId);
    }
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
    // Support both 'claude' (internal type) and 'sdk' (API schema) naming conventions
    const claudeOptions = request.options?.claude || (request.options as any)?.sdk || {};

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
      enableHooks: claudeOptions.enableHooks,
      hookConfig: claudeOptions.hookConfig,
      abortController,
      onProgress,
    };
  }
}
