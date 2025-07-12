import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { logger } from "../utils/logger";
import { config } from "../config";

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
  onProgress?: (progress: { type: string; message: string }) => void | Promise<void>;
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
  ): Promise<{ messages: SDKMessage[]; success: boolean; error?: Error }> {
    const abortController = options.abortController || new AbortController();
    const messages: SDKMessage[] = [];

    try {
      logger.debug("Executing task with Claude Code SDK", {
        promptLength: prompt.length,
        options: {
          maxTurns: options.maxTurns,
          cwd: options.cwd,
        },
      });

      let turnCount = 0;

      for await (const message of query({
        prompt,
        abortController,
        options: {
          maxTurns: options.maxTurns || config.claudeCodeSDK.defaultMaxTurns,
          cwd: options.cwd,
          allowedTools: options.allowedTools,
          disallowedTools: options.disallowedTools,
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

        // Track turns and tool usage
        if (message.type === "assistant") {
          turnCount++;
        }

        // Emit progress if callback provided
        if (options.onProgress) {
          // Send turn progress
          if (message.type === "assistant" && turnCount === 1) {
            await options.onProgress({
              type: "log",
              message: `[開始] ターン ${turnCount}/${options.maxTurns || config.claudeCodeSDK.defaultMaxTurns}`,
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

      return { messages, success: true };
    } catch (error) {
      logger.error("Task execution failed", { error, prompt });
      return {
        messages,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
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
}
