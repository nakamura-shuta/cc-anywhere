import type { ClaudeCodeClient } from "./claude-code-client";
import { StreamingTaskExecutor } from "../services/streaming-task-executor";
import type { TaskRequest, ClaudeExecutionResult } from "./types";
import { logger } from "../utils/logger";

export interface StreamingExecutionResult extends ClaudeExecutionResult {
  streamingExecutor?: StreamingTaskExecutor;
}

export class StreamingClaudeExecutor {
  constructor(private claudeClient: ClaudeCodeClient) {}

  async executeWithStreaming(
    task: TaskRequest,
    taskId: string,
    sessionId: string,
  ): Promise<StreamingExecutionResult> {
    const startTime = Date.now();
    const streamingExecutor = new StreamingTaskExecutor(taskId, sessionId);

    try {
      logger.info("Starting streaming task execution", {
        taskId,
        sessionId,
        instruction: task.instruction.substring(0, 100) + "...",
      });

      // 初期プロンプトを設定
      streamingExecutor.setInitialPrompt(task.instruction);

      // アボートコントローラーを設定
      if (task.options?.abortController) {
        streamingExecutor.setAbortController(task.options.abortController);
      }

      // ストリーミング入力を使用してタスクを実行
      const result = await this.claudeClient.executeTask(streamingExecutor.generateUserMessages(), {
        ...task.options?.sdk,
        cwd: task.context?.workingDirectory,
        abortController: task.options?.abortController,
      });

      // 実行完了
      streamingExecutor.markCompleted();

      const duration = Date.now() - startTime;
      logger.info("Streaming task execution completed", {
        taskId,
        success: result.success,
        messageCount: streamingExecutor.getMessageCount(),
        duration,
      });

      return {
        success: result.success,
        output: result.success
          ? this.claudeClient.formatMessagesAsString(result.messages)
          : undefined,
        error: result.error,
        logs: [],
        duration,
        streamingExecutor,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Streaming task execution failed", {
        taskId,
        error,
        duration,
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        logs: [],
        duration,
        streamingExecutor,
      };
    }
  }
}
