import type { WebSocket } from "ws";
import { StreamingClaudeExecutor } from "../../claude/streaming-executor";
import type { StreamingTaskExecutor } from "../../services/streaming-task-executor";
import { ClaudeCodeClient } from "../../claude/claude-code-client";
import { logger } from "../../utils/logger";
import { config } from "../../config";
import type { TaskRequest } from "../../claude/types";

interface StreamingMessage {
  type: "auth" | "start_task" | "user_instruction" | "stop_task";
  apiKey?: string;
  taskRequest?: TaskRequest;
  instruction?: string;
  taskId?: string;
}

export class StreamingWebSocketHandler {
  private activeExecutors = new Map<string, StreamingTaskExecutor>();
  private claudeClient = new ClaudeCodeClient();
  private streamingExecutor = new StreamingClaudeExecutor(this.claudeClient);

  async handleConnection(connection: WebSocket, _request: any) {
    const socket = connection;
    let authenticated = false;
    let currentTaskId: string | undefined;

    logger.info("New streaming WebSocket connection");

    socket.on("message", async (data: Buffer) => {
      try {
        const message: StreamingMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "auth":
            authenticated = await this.handleAuth(message.apiKey, socket);
            break;

          case "start_task":
            if (!authenticated) {
              socket.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
              return;
            }
            currentTaskId = await this.handleStartTask(message.taskRequest!, socket);
            break;

          case "user_instruction":
            if (!authenticated || !currentTaskId) {
              socket.send(JSON.stringify({ type: "error", message: "No active task" }));
              return;
            }
            this.handleUserInstruction(currentTaskId, message.instruction!);
            break;

          case "stop_task":
            if (currentTaskId) {
              this.handleStopTask(currentTaskId);
              currentTaskId = undefined;
            }
            break;
        }
      } catch (error) {
        logger.error("WebSocket message handling error", { error });
        socket.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
        );
      }
    });

    socket.on("close", () => {
      if (currentTaskId) {
        this.handleStopTask(currentTaskId);
      }
      logger.info("Streaming WebSocket connection closed");
    });
  }

  private async handleAuth(apiKey: string | undefined, socket: any): Promise<boolean> {
    // Check if authentication is enabled
    if (!config.auth.enabled) {
      socket.send(JSON.stringify({ type: "auth_success" }));
      return true;
    }

    // Validate API key
    if (!apiKey || apiKey !== config.auth.apiKey) {
      socket.send(JSON.stringify({ type: "auth_failed" }));
      return false;
    }

    socket.send(JSON.stringify({ type: "auth_success" }));
    return true;
  }

  private async handleStartTask(taskRequest: TaskRequest, socket: any): Promise<string> {
    const taskId = `streaming-${Date.now()}`;
    const sessionId = `session-${Date.now()}`;

    logger.info("Starting streaming task", { taskId, instruction: taskRequest.instruction });

    // 非同期でタスクを実行
    void this.executeStreamingTask(taskId, sessionId, taskRequest, socket);

    socket.send(
      JSON.stringify({
        type: "task_started",
        taskId,
        sessionId,
      }),
    );

    return taskId;
  }

  private async executeStreamingTask(
    taskId: string,
    sessionId: string,
    taskRequest: TaskRequest,
    socket: any,
  ) {
    try {
      // onProgressコールバックを設定してログをストリーミング
      const enhancedRequest: TaskRequest = {
        ...taskRequest,
        options: {
          ...taskRequest.options,
          onProgress: async (progress) => {
            socket.send(
              JSON.stringify({
                type: "progress",
                taskId,
                progress,
              }),
            );
          },
        },
      };

      const result = await this.streamingExecutor.executeWithStreaming(
        enhancedRequest,
        taskId,
        sessionId,
      );

      // StreamingTaskExecutorを保存
      if (result.streamingExecutor) {
        this.activeExecutors.set(taskId, result.streamingExecutor);
      }

      socket.send(
        JSON.stringify({
          type: "task_completed",
          taskId,
          result: {
            success: result.success,
            output: result.output,
            error: result.error?.message,
            duration: result.duration,
          },
        }),
      );
    } catch (error) {
      logger.error("Streaming task execution error", { taskId, error });
      socket.send(
        JSON.stringify({
          type: "task_error",
          taskId,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    } finally {
      this.activeExecutors.delete(taskId);
    }
  }

  private handleUserInstruction(taskId: string, instruction: string) {
    const executor = this.activeExecutors.get(taskId);
    if (!executor) {
      logger.warn("No active executor for task", { taskId });
      return;
    }

    executor.addUserInstruction(instruction);
    logger.info("Added user instruction", { taskId, instruction });
  }

  private handleStopTask(taskId: string) {
    const executor = this.activeExecutors.get(taskId);
    if (executor) {
      executor.markCompleted();
      this.activeExecutors.delete(taskId);
      logger.info("Stopped streaming task", { taskId });
    }
  }
}
