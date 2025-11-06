import { type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../utils/logger";
import { config } from "../config";
import { messageTracker } from "./types/message-tracking";
import { TaskTracker } from "../services/task-tracker";
import type { ToolUsageDetail, TaskProgressInfo } from "../types/enhanced-logging";
import { LogLevel } from "../types/enhanced-logging";
import type { WebSearchConfig } from "./types";
import type { ClaudeCodeStrategy, ExecutionMode, QueryOptions } from "./strategies";
import { ClaudeCodeClientFactory } from "./claude-code-client-factory";

export interface ClaudeCodeOptions {
  maxTurns?: number;
  cwd?: string;
  abortController?: AbortController;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
  executable?: "bun" | "deno" | "node";
  executableArgs?: string[];
  mcpConfig?: Record<string, any>;
  continueSession?: boolean;
  resumeSession?: string;
  continueFromTaskId?: string; // Task ID to continue session from
  outputFormat?: string;
  verbose?: boolean;
  onProgress?: (progress: { type: string; message: string; data?: any }) => void | Promise<void>;
  enableWebSearch?: boolean;
  webSearchConfig?: WebSearchConfig;
}

export class ClaudeCodeClient {
  private strategy: ClaudeCodeStrategy;

  constructor(private clientConfig: typeof config = config) {
    this.strategy = ClaudeCodeClientFactory.createStrategy(this.determineExecutionMode(), {
      claudeApiKey: clientConfig.claude.apiKey,
      awsAccessKeyId: clientConfig.aws?.accessKeyId,
      awsSecretAccessKey: clientConfig.aws?.secretAccessKey,
      awsRegion: clientConfig.aws?.region,
      forceExecutionMode: clientConfig.forceExecutionMode,
    });
  }

  async executeTask(
    prompt: string,
    options: ClaudeCodeOptions = {},
    taskId?: string,
  ): Promise<{
    messages: SDKMessage[];
    success: boolean;
    error?: Error;
    tracker?: TaskTracker;
    sessionId?: string;
  }> {
    const abortController = options.abortController || new AbortController();
    const messages: SDKMessage[] = [];
    const tracker = new TaskTracker();
    const startTime = Date.now();
    let sessionId: string | undefined;

    // Generate taskId if not provided (for UUID tracking)
    const effectiveTaskId =
      taskId || `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Tool tracking for duration calculation (タスクごとに独立)
    const toolStartTimes: Map<string, number> = new Map();
    const toolNameMap: Map<string, string> = new Map();

    try {
      logger.debug("Executing task with Claude Code SDK", {
        promptLength: prompt.length,
        options: {
          maxTurns: options.maxTurns,
          cwd: options.cwd,
        },
      });

      // Record initial progress
      tracker.recordProgress({
        phase: "setup",
        message: "タスク実行を開始します",
        level: LogLevel.INFO,
      });

      let turnCount = 0;
      const maxTurns = options.maxTurns || config.claudeCodeSDK.defaultMaxTurns;

      // If web search is enabled, add WebSearch to allowed tools
      const allowedTools = options.allowedTools || [];
      if (options.enableWebSearch && !allowedTools.includes("WebSearch")) {
        allowedTools.push("WebSearch");
      }

      // Ensure TodoWrite is always allowed unless explicitly disallowed
      const finalAllowedTools = allowedTools.length > 0 ? allowedTools : undefined;
      const finalDisallowedTools = options.disallowedTools || [];

      // Log the tools configuration
      logger.debug("Claude Code SDK tools configuration", {
        allowedTools: finalAllowedTools,
        disallowedTools: finalDisallowedTools,
      });

      const queryOptions: QueryOptions = {
        prompt,
        abortController,
        options: {
          maxTurns: maxTurns,
          cwd: options.cwd,
          allowedTools: finalAllowedTools,
          disallowedTools: finalDisallowedTools,
          customSystemPrompt: options.systemPrompt,
          permissionMode: options.permissionMode,
          executable: options.executable,
          executableArgs: options.executableArgs,
          mcpServers: options.mcpConfig,
          // Session continuation: Only 'resume' is needed for explicit session continuation
          // Reference: https://docs.claude.com/en/api/agent-sdk/sessions
          // NOTE: 'continue: true' auto-loads the LATEST session (not what we want)
          // We use 'resume' to specify exact session ID for continuation
          // For base tasks, omit both 'continue' and 'resume' to create new sessions
          ...(options.resumeSession
            ? {
                resume: options.resumeSession, // Session ID to resume
                forkSession: false, // Continue (not fork) the session
              }
            : {}),
          // NOTE: continueFromTaskId is NOT passed to SDK - it's only used internally
          // to resolve the session ID, which is passed via 'resume'
        },
      };

      logger.info("QueryOptions being passed to Claude Code SDK", {
        taskId: effectiveTaskId,
        resume: queryOptions.options?.resume,
        forkSession: queryOptions.options?.forkSession,
        hasCwd: !!queryOptions.options?.cwd,
        hasAllowedTools: !!queryOptions.options?.allowedTools,
      });

      logger.debug("Starting Claude Code SDK executeQuery", {
        executionMode: this.getCurrentMode(),
      });

      const queryIterator = this.strategy.executeQuery(queryOptions);
      for await (const message of queryIterator) {
        messages.push(message);
        logger.debug("Received SDK message", {
          type: message.type,
          message: JSON.stringify(message),
        });

        // UUID tracking (SDK 1.0.86+)
        if ("uuid" in message) {
          const tracked = messageTracker.track(effectiveTaskId, message);
          if (tracked) {
            logger.debug("Message tracked with UUID", {
              uuid: tracked.uuid,
              type: tracked.type,
              taskId: effectiveTaskId,
            });
          }
        }

        // Extract session ID from system message
        if (message.type === "system" && !sessionId && "session_id" in message) {
          sessionId = (message as any).session_id;
        }

        // Track turns and tool usage
        if (message.type === "assistant") {
          turnCount++;

          // Claudeの応答テキストを抽出して送信
          const textContent = this.extractTextContent(message);
          if (textContent && options.onProgress) {
            await options.onProgress({
              type: "claude:response",
              message: textContent,
              data: { turnNumber: turnCount, maxTurns },
            });
          }
        }

        // Extract and track tool usage
        const toolDetails = this.extractToolUsageFromMessage(message, toolStartTimes, toolNameMap);
        for (const toolDetail of toolDetails) {
          if (toolDetail.action === "start") {
            // Tool start event
            if (options.onProgress) {
              // Extract formatted details for specific tools
              let formattedInput = "";
              if (toolDetail.input && typeof toolDetail.input === "object") {
                const input = toolDetail.input as Record<string, any>;

                switch (toolDetail.tool) {
                  case "TodoWrite":
                    if (input.todos && Array.isArray(input.todos)) {
                      formattedInput = input.todos
                        .map((todo: any) => {
                          const statusIcon =
                            todo.status === "completed"
                              ? "✅"
                              : todo.status === "in_progress"
                                ? "🔄"
                                : "⬜";
                          return `${statusIcon} ${todo.content}`;
                        })
                        .join("\n");
                    }
                    break;
                  case "Read":
                  case "Write":
                  case "Edit":
                  case "MultiEdit":
                    formattedInput = input.file_path || input.path || "";
                    break;
                  case "Bash":
                    formattedInput = input.command || "";
                    break;
                  case "Grep":
                  case "Glob":
                    formattedInput = input.pattern || "";
                    if (input.path) {
                      formattedInput += ` in ${input.path}`;
                    }
                    break;
                  case "WebFetch":
                  case "WebSearch":
                    formattedInput = input.url || input.query || "";
                    break;
                  case "LS":
                    formattedInput = input.path || "";
                    break;
                  default: {
                    // For other tools, show a brief summary
                    const keys = Object.keys(input).slice(0, 3);
                    formattedInput = keys
                      .map((k) => `${k}: ${String(input[k]).slice(0, 50)}`)
                      .join(", ");
                  }
                }
              }

              await options.onProgress({
                type: "tool:start",
                message: `${toolDetail.tool} 実行開始`,
                data: {
                  toolId: toolDetail.toolId,
                  tool: toolDetail.tool,
                  input: toolDetail.input,
                  formattedInput, // Add formatted input for display
                },
              });
            }
          } else if (toolDetail.action === "end") {
            // Tool end event
            if (options.onProgress) {
              await options.onProgress({
                type: "tool:end",
                message: `${toolDetail.tool} 実行完了`,
                data: {
                  toolId: toolDetail.toolId,
                  tool: toolDetail.tool,
                  output: toolDetail.output,
                  error: toolDetail.error,
                  duration: toolDetail.duration,
                  success: toolDetail.success,
                },
              });
            }
          }

          // Track tool usage (record each tool detail for proper statistics)
          logger.debug("Recording tool usage", {
            toolDetailsCount: toolDetails.length,
            toolDetails: toolDetails.map((d) => ({
              tool: d.tool,
              status: d.status,
              action: d.action,
            })),
          });
          for (const detail of toolDetails) {
            tracker.recordToolUsage(detail);
          }

          // Legacy tool_usage event (for backward compatibility)
          if (toolDetail.tool !== "TodoWrite" && toolDetail.action === "end") {
            if (options.onProgress) {
              await options.onProgress({
                type: "tool_usage",
                message: this.formatToolUsageMessage(toolDetail),
                data: toolDetail,
              });
            }
          }
        }

        // Handle TodoWrite results
        if (message.type === "assistant") {
          const assistantMsg = message as any;
          if (assistantMsg.message?.content && Array.isArray(assistantMsg.message.content)) {
            for (const content of assistantMsg.message.content) {
              if (
                content.type === "tool_use" &&
                content.name === "TodoWrite" &&
                content.input?.todos
              ) {
                tracker.updateTodos(content.input.todos);

                logger.info("TodoWrite tool used", {
                  todosCount: content.input.todos.length,
                  todos: content.input.todos,
                });

                // Send todo update notification
                if (options.onProgress) {
                  await options.onProgress({
                    type: "todo_update",
                    message: `Todoリスト更新: ${content.input.todos.length}件`,
                    data: { todos: content.input.todos },
                  });
                }
              }
            }
          }
        }

        // Emit progress if callback provided
        if (options.onProgress) {
          // Send turn progress for each turn
          if (message.type === "assistant") {
            const progressInfo: TaskProgressInfo = {
              phase: "execution",
              message: `ターン ${turnCount}/${options.maxTurns || config.claudeCodeSDK.defaultMaxTurns}`,
              level: LogLevel.INFO,
              timestamp: new Date(),
            };
            tracker.recordProgress(progressInfo);
            await options.onProgress({
              type: "progress",
              message: progressInfo.message,
              data: progressInfo,
            });
          }

          const logContent = this.extractProgressContent(message);
          if (logContent) {
            await options.onProgress({ type: "log", message: logContent });
          }
        }
      }

      logger.info("Task execution completed", {
        messageCount: messages.length,
      });

      // Send final statistics
      if (options.onProgress) {
        const stats = tracker.getStatistics();
        const elapsedTime = Date.now() - startTime;

        await options.onProgress({
          type: "statistics",
          message: "タスク統計情報",
          data: {
            totalTurns: turnCount,
            totalToolCalls: stats.totalToolUsage,
            toolStats: Object.fromEntries(
              Array.from(stats.toolUsageByType.entries()).map(([tool, details]) => [
                tool,
                {
                  count: details.count,
                  successes: details.successCount,
                  failures: details.failureCount,
                  totalDuration: 0, // TODO: 実際の所要時間を計算
                  avgDuration: 0,
                },
              ]),
            ),
            currentPhase: "complete",
            elapsedTime,
          },
        });
      }

      tracker.recordProgress({
        phase: "complete",
        message: "タスクが正常に完了しました",
        level: LogLevel.SUCCESS,
      });

      // UUID tracking statistics
      const trackingStats = messageTracker.getTaskStats(effectiveTaskId);
      logger.info("Message tracking statistics", {
        taskId: effectiveTaskId,
        ...trackingStats,
      });

      logger.debug("ClaudeCodeClient executeTask completed", {
        taskId: effectiveTaskId,
        messageCount: messages.length,
        sessionId,
      });

      return { messages, success: true, tracker, sessionId };
    } catch (error) {
      // Get message context for error
      const errorContext = {
        taskId: effectiveTaskId,
        messageStats: messageTracker.getTaskStats(effectiveTaskId),
        lastMessages: messageTracker
          .getByTaskId(effectiveTaskId)
          .slice(-3)
          .map((m) => ({
            uuid: m.uuid,
            type: m.type,
            timestamp: m.timestamp,
          })),
      };

      logger.error("Task execution failed", { error, prompt, errorContext });

      tracker.recordError(error instanceof Error ? error.message : String(error));
      tracker.recordProgress({
        phase: "complete",
        message: "タスクの実行中にエラーが発生しました",
        level: LogLevel.ERROR,
      });

      return {
        messages,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        tracker,
        sessionId,
      };
    }
  }

  /**
   * Clear message tracking data for a specific task
   * @param taskId Task ID to clear
   */
  clearTaskMessages(taskId: string): void {
    messageTracker.clearTask(taskId);
    logger.debug("Cleared message tracking for task", { taskId });
  }

  /**
   * Get message tracking statistics for a task
   * @param taskId Task ID to get stats for
   */
  getTaskMessageStats(taskId: string): ReturnType<typeof messageTracker.getTaskStats> {
    return messageTracker.getTaskStats(taskId);
  }

  formatMessagesAsString(messages: SDKMessage[]): string {
    const formattedMessages: string[] = [];

    for (const msg of messages) {
      try {
        switch (msg.type) {
          case "assistant": {
            // Extract content from assistant messages
            const assistantMsg = msg as unknown as {
              message?: {
                content?: Array<{ type: string; text?: string }>;
              };
            };
            if (assistantMsg.message?.content) {
              // Handle content array
              for (const content of assistantMsg.message.content) {
                if (content.type === "text" && content.text) {
                  formattedMessages.push(content.text);
                }
              }
            }
            break;
          }
          case "result": {
            // Optionally include result summary
            const resultMsg = msg as unknown as {
              result?: unknown;
              subtype?: string;
            };
            if (resultMsg.result && resultMsg.subtype === "success") {
              // Result is already included in assistant messages, skip
            }
            break;
          }
          case "system": {
            // Skip system messages
            break;
          }
          default: {
            logger.debug("Unhandled message type", { type: msg.type });
          }
        }
      } catch (error) {
        logger.error("Error formatting message", { error, msg });
      }
    }

    // Join messages with double newlines
    return formattedMessages.join("\n\n");
  }

  private extractProgressContent(message: SDKMessage): string | null {
    if (message.type === "result") {
      return this.extractResultMessage(message);
    } else if (message.type === "assistant") {
      return this.extractAssistantMessage(message);
    }
    return null;
  }

  private extractTextContent(message: any): string | null {
    if (message.type === "assistant" && message.message?.content) {
      const textParts: string[] = [];
      for (const content of message.message.content) {
        if (content.type === "text" && content.text) {
          textParts.push(content.text);
        }
      }
      return textParts.length > 0 ? textParts.join("\n") : null;
    }
    return null;
  }

  private extractToolUsageFromMessage(
    message: SDKMessage,
    toolStartTimes: Map<string, number>,
    toolNameMap: Map<string, string>,
  ): ToolUsageDetail[] {
    const toolDetails: ToolUsageDetail[] = [];

    if (message.type === "assistant") {
      const assistantMsg = message as any;
      if (assistantMsg.message?.content && Array.isArray(assistantMsg.message.content)) {
        for (const content of assistantMsg.message.content) {
          if (content.type === "tool_use") {
            const toolId = content.id;
            const startTime = Date.now();

            // Store start time and tool name for later use
            toolStartTimes.set(toolId, startTime);
            toolNameMap.set(toolId, content.name);

            // Tool start
            toolDetails.push({
              tool: content.name,
              status: "start",
              action: "start",
              input: content.input,
              timestamp: new Date(),
              toolId,
            });
          }
        }
      }
    } else if (message.type === "result") {
      const resultMsg = message as any;
      if (resultMsg.result && Array.isArray(resultMsg.result)) {
        for (const result of resultMsg.result) {
          if (result.type === "tool_result") {
            const toolId = result.tool_use_id;
            const endTime = Date.now();
            const startTime = toolStartTimes.get(toolId) || endTime;
            const toolName = toolNameMap.get(toolId) || "unknown";
            const duration = endTime - startTime;

            // Clean up tracking maps
            toolStartTimes.delete(toolId);
            toolNameMap.delete(toolId);

            // Tool end
            toolDetails.push({
              tool: toolName,
              status: result.is_error ? "failure" : "success",
              action: "end",
              output: result.content,
              error: result.is_error ? result.content : undefined,
              success: !result.is_error,
              timestamp: new Date(),
              duration,
              toolId,
            });
          }
        }
      }
    }

    return toolDetails;
  }

  private extractResultMessage(message: SDKMessage): string | null {
    const resultMsg = message as unknown as {
      result?: unknown;
      subtype?: string;
      tool?: string;
      input?: unknown;
    };

    if (!resultMsg.tool) {
      return null;
    }

    let output = "";

    switch (resultMsg.tool) {
      case "bash":
      case "Bash": {
        // Extract command from input
        let command = "";
        if (
          typeof resultMsg.input === "object" &&
          resultMsg.input !== null &&
          "command" in resultMsg.input
        ) {
          command = String((resultMsg.input as { command: unknown }).command);
        }

        if (command) {
          output = `[Bash] 実行: ${command}\n`;
        }

        if (typeof resultMsg.result === "string") {
          output += resultMsg.result;
        } else if (
          typeof resultMsg.result === "object" &&
          resultMsg.result !== null &&
          "output" in resultMsg.result
        ) {
          output += String((resultMsg.result as { output: unknown }).output);
        }
        break;
      }

      case "TodoWrite": {
        if (resultMsg.result && typeof resultMsg.result === "object") {
          const todoResult = resultMsg.result as { todos?: any[] };
          if (todoResult.todos) {
            // TodoWriteの結果はログに出力しない（UIで別途表示するため）
            output = "";
          } else {
            output = "";
          }
        }
        break;
      }

      case "Write":
        // Extract file path from input
        if (
          typeof resultMsg.input === "object" &&
          resultMsg.input !== null &&
          "file_path" in resultMsg.input
        ) {
          const filePath = String((resultMsg.input as { file_path: unknown }).file_path);
          output = `[Write] ${resultMsg.subtype === "success" ? "✓" : "✗"} ファイル作成: ${filePath}`;
        } else {
          output = `[Write] ${resultMsg.subtype === "success" ? "✓" : "✗"} 実行完了`;
        }
        break;

      case "Edit":
        // Extract file path from input
        if (
          typeof resultMsg.input === "object" &&
          resultMsg.input !== null &&
          "file_path" in resultMsg.input
        ) {
          const filePath = String((resultMsg.input as { file_path: unknown }).file_path);
          output = `[Edit] ${resultMsg.subtype === "success" ? "✓" : "✗"} ファイル編集: ${filePath}`;
        } else {
          output = `[Edit] ${resultMsg.subtype === "success" ? "✓" : "✗"} 実行完了`;
        }
        break;

      case "Read":
        // Extract file path from input
        if (
          typeof resultMsg.input === "object" &&
          resultMsg.input !== null &&
          "file_path" in resultMsg.input
        ) {
          const filePath = String((resultMsg.input as { file_path: unknown }).file_path);
          output = `[Read] ${resultMsg.subtype === "success" ? "✓" : "✗"} ファイル読み取り: ${filePath}`;
        } else {
          output = `[Read] ${resultMsg.subtype === "success" ? "✓" : "✗"} 実行完了`;
        }
        break;

      case "LS":
      case "Glob":
      case "Grep": {
        // Extract search pattern or path
        if (typeof resultMsg.input === "object" && resultMsg.input !== null) {
          const input = resultMsg.input as Record<string, unknown>;
          const pattern = input.pattern || input.path || "";
          output = `[${resultMsg.tool}] ${resultMsg.subtype === "success" ? "✓" : "✗"} 検索: ${String(pattern)}`;
        } else {
          output = `[${resultMsg.tool}] ${resultMsg.subtype === "success" ? "✓" : "✗"} 実行完了`;
        }
        break;
      }

      default:
        // For other tools, try to extract meaningful info
        if (resultMsg.subtype === "success") {
          return `[${resultMsg.tool}] 実行完了`;
        }
    }

    return output || null;
  }

  private extractAssistantMessage(message: SDKMessage): string | null {
    // Extract text content from assistant messages
    const assistantMsg = message as unknown as {
      message?: {
        content?: Array<{
          type: string;
          text?: string;
          tool_use?: { name?: string; input?: unknown };
        }>;
      };
    };
    if (assistantMsg.message?.content) {
      for (const content of assistantMsg.message.content) {
        if (content.type === "text" && content.text) {
          // Emit progress updates for task descriptions
          const text = content.text.trim();

          // すべてのassistantメッセージを返す（最初の500文字まで）
          if (text.length > 500) {
            return text.substring(0, 500) + "...";
          }
          return text;
        } else if (content.type === "tool_use" && content.tool_use?.name) {
          // Tool usage notification with details
          const toolName = content.tool_use.name;
          let detail = "";

          if (content.tool_use.input && typeof content.tool_use.input === "object") {
            const input = content.tool_use.input as Record<string, unknown>;
            if (toolName === "Write" && input.file_path) {
              detail = `: ${String(input.file_path)}`;
            } else if ((toolName === "bash" || toolName === "Bash") && input.command) {
              detail = `: ${String(input.command)}`;
            }
          }

          return `[準備中] ${toolName}${detail}`;
        }
      }
    }

    return null;
  }

  private formatToolUsageMessage(detail: ToolUsageDetail): string {
    const statusIcon = detail.status === "success" ? "✓" : detail.status === "failure" ? "✗" : "⚡";
    const statusText =
      detail.status === "start" ? "開始" : detail.status === "success" ? "成功" : "失敗";

    let message = `[${detail.tool}] ${statusIcon} ${statusText}`;

    // Add specific details based on tool type
    if (detail.filePath) {
      message += `: ${detail.filePath}`;
    } else if (detail.command) {
      message += `: ${detail.command}`;
    } else if (detail.pattern) {
      message += `: ${detail.pattern}`;
    } else if (detail.url) {
      message += `: ${detail.url}`;
    }

    if (detail.error && detail.status === "failure") {
      message += ` (エラー: ${detail.error})`;
    }

    return message;
  }

  /**
   * Switch to a different execution strategy
   * @param mode Execution mode to switch to
   */
  switchStrategy(mode: ExecutionMode): void {
    this.strategy = ClaudeCodeClientFactory.createStrategy(mode, {
      claudeApiKey: this.clientConfig.claude.apiKey,
      awsAccessKeyId: this.clientConfig.aws?.accessKeyId,
      awsSecretAccessKey: this.clientConfig.aws?.secretAccessKey,
      awsRegion: this.clientConfig.aws?.region,
    });
    logger.info(`Switched to ${mode} mode`);
  }

  /**
   * Get the current execution mode
   * @returns Current execution mode
   */
  getCurrentMode(): ExecutionMode {
    return this.strategy.getExecutionMode();
  }

  /**
   * Check if a specific mode is available
   * @param mode Optional mode to check. If not provided, checks current mode
   * @returns true if mode is available
   */
  isAvailable(mode?: ExecutionMode): boolean {
    if (mode) {
      try {
        const strategy = ClaudeCodeClientFactory.createStrategy(mode, {
          claudeApiKey: this.clientConfig.claude.apiKey,
          awsAccessKeyId: this.clientConfig.aws?.accessKeyId,
          awsSecretAccessKey: this.clientConfig.aws?.secretAccessKey,
          awsRegion: this.clientConfig.aws?.region,
        });
        return strategy.isAvailable();
      } catch {
        return false;
      }
    }
    return this.strategy.isAvailable();
  }

  /**
   * Get the current model name
   * @returns Model name being used
   */
  getModelName(): string {
    return this.strategy.getModelName();
  }

  /**
   * Determine the execution mode based on available credentials
   * @returns Execution mode to use
   */
  private determineExecutionMode(): ExecutionMode {
    return ClaudeCodeClientFactory.determineExecutionMode({
      claudeApiKey: this.clientConfig.claude.apiKey,
      awsAccessKeyId: this.clientConfig.aws?.accessKeyId,
      awsSecretAccessKey: this.clientConfig.aws?.secretAccessKey,
      awsRegion: this.clientConfig.aws?.region,
      forceExecutionMode: this.clientConfig.forceExecutionMode,
    });
  }
}
