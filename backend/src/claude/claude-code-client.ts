import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { logger } from "../utils/logger";
import { config } from "../config";
import { TaskTracker } from "../services/task-tracker";
import type { ToolUsageDetail, TaskProgressInfo } from "../types/enhanced-logging";
import { LogLevel } from "../types/enhanced-logging";
import type { WebSearchConfig } from "./types";

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
  outputFormat?: string;
  verbose?: boolean;
  onProgress?: (progress: { type: string; message: string; data?: any }) => void | Promise<void>;
  enableWebSearch?: boolean;
  webSearchConfig?: WebSearchConfig;
}

export class ClaudeCodeClient {
  constructor() {
    // Ensure API key is set
    if (!config.claude.apiKey) {
      throw new Error("CLAUDE_API_KEY environment variable is required");
    }
  }

  async executeTask(
    prompt: string,
    options: ClaudeCodeOptions = {},
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
      logger.info("Claude Code SDK tools configuration", {
        allowedTools: finalAllowedTools,
        disallowedTools: finalDisallowedTools,
        hasTodoWriteInAllowed: finalAllowedTools?.includes("TodoWrite"),
        hasTodoWriteInDisallowed: finalDisallowedTools.includes("TodoWrite"),
      });

      for await (const message of query({
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
          continue: options.continueSession,
          resume: options.resumeSession,
          // outputFormat and verbose are not supported by SDK
        },
      })) {
        messages.push(message);
        logger.debug("Received SDK message", {
          type: message.type,
          message: JSON.stringify(message),
        });

        // Extract session ID if available
        if (!sessionId && (message as any).session_id) {
          sessionId = (message as any).session_id;
          logger.info("Claude Code SDK session ID detected", { sessionId });
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
        const toolDetails = this.extractToolUsageFromMessage(message);
        for (const toolDetail of toolDetails) {
          if (toolDetail.action === "start") {
            // Tool start event
            if (options.onProgress) {
              await options.onProgress({
                type: "tool:start",
                message: `${toolDetail.tool} 実行開始`,
                data: {
                  toolId: toolDetail.toolId,
                  tool: toolDetail.tool,
                  input: toolDetail.input,
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

      return { messages, success: true, tracker, sessionId };
    } catch (error) {
      logger.error("Task execution failed", { error, prompt });

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

  // Tool tracking for duration calculation
  private toolStartTimes: Map<string, number> = new Map();
  private toolNameMap: Map<string, string> = new Map();

  private extractToolUsageFromMessage(message: SDKMessage): ToolUsageDetail[] {
    const toolDetails: ToolUsageDetail[] = [];

    if (message.type === "assistant") {
      const assistantMsg = message as any;
      if (assistantMsg.message?.content && Array.isArray(assistantMsg.message.content)) {
        for (const content of assistantMsg.message.content) {
          if (content.type === "tool_use") {
            const toolId = content.id;
            const startTime = Date.now();

            // Store start time and tool name for later use
            this.toolStartTimes.set(toolId, startTime);
            this.toolNameMap.set(toolId, content.name);

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
            const startTime = this.toolStartTimes.get(toolId) || endTime;
            const toolName = this.toolNameMap.get(toolId) || "unknown";
            const duration = endTime - startTime;

            // Clean up tracking maps
            this.toolStartTimes.delete(toolId);
            this.toolNameMap.delete(toolId);

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

          // Look for action indicators in both Japanese and English
          if (
            text.match(
              /^(実行|作成|編集|読み取り|検索|確認|分析|処理|インストール|Installing|Creating|Writing|Reading|Executing|Checking)/i,
            )
          ) {
            return text.split("\n")[0] || null; // First line only
          }

          // Short status updates
          if (text.length < 150 && !text.includes("\n\n")) {
            return text;
          }
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
}
