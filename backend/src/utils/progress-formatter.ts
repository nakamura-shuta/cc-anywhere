/**
 * Progress message formatting utility
 *
 * This utility provides common formatting functions for progress messages
 * shared between TaskExecutor and TaskGroupExecutor
 */

/**
 * Progress message interface
 */
export interface ProgressMessage {
  type: string;
  message?: string;
  data?: any;
  tool?: string;
  input?: any;
  output?: any;
}

/**
 * Formatted log message for output
 */
export interface FormattedLog {
  message: string;
  level: "info" | "warning" | "error" | "debug";
}

/**
 * Progress formatter utility class
 *
 * Provides static methods for formatting various types of progress messages
 * in a consistent manner across the application.
 */
export class ProgressFormatter {
  /**
   * Format a progress message based on its type
   * @param progress Progress message to format
   * @returns Formatted log or null if no message
   */
  static formatProgressMessage(progress: ProgressMessage): FormattedLog | null {
    let message = "";
    let level: FormattedLog["level"] = "info";

    switch (progress.type) {
      case "log":
        message = progress.message || "";
        break;

      case "tool:start":
        message = this.formatToolStartMessage(progress);
        break;

      case "tool:end":
        message = this.formatToolEndMessage(progress);
        break;

      case "claude:response":
        message = this.formatClaudeResponse(progress.message || "");
        break;

      case "tool_usage":
        message = this.formatLegacyToolUsage(progress);
        break;

      case "todo_update":
        message = this.formatTodoUpdate(progress.message || "");
        break;

      case "progress":
        message = this.formatProgress(progress.message || "");
        break;

      case "summary":
        message = progress.message || "";
        level = "info";
        break;

      case "statistics":
        message = this.formatStatistics(progress.message || "");
        break;

      default:
        if (progress.message) {
          message = progress.message;
        }
        break;
    }

    return message ? { message, level } : null;
  }

  /**
   * Format tool start message
   * @param progress Progress message containing tool information
   * @returns Formatted tool start message
   */
  static formatToolStartMessage(progress: ProgressMessage): string {
    const toolName = progress.data?.tool || progress.tool || "unknown";
    const input = progress.data?.input || progress.input || "";

    switch (toolName) {
      case "bash":
        return `🔧 Executing command: ${typeof input === "object" ? input.command : input}`;
      case "read":
        return `📖 Reading file: ${typeof input === "object" ? input.file_path : input}`;
      case "write":
      case "edit":
        return `✏️ ${toolName === "write" ? "Writing" : "Editing"} file: ${
          typeof input === "object" ? input.file_path : input
        }`;
      case "search":
      case "grep":
        return `🔍 Searching for: ${
          typeof input === "object" ? input.pattern || input.query : input
        }`;
      default:
        return `🔧 Using tool: ${toolName}`;
    }
  }

  /**
   * Format tool end message
   * @param progress Progress message containing tool output
   * @returns Formatted tool end message
   */
  static formatToolEndMessage(progress: ProgressMessage): string {
    const toolName = progress.data?.tool || progress.tool || "unknown";
    const output = progress.data?.output || progress.output;

    if (toolName === "bash" && output) {
      const lines = String(output).split("\n").slice(0, 3);
      const preview = lines.join("\n");
      const hasMore = String(output).split("\n").length > 3;
      return `✓ Command output:\n${preview}${hasMore ? "\n..." : ""}`;
    }
    return `✓ Tool completed: ${toolName}`;
  }

  /**
   * Format legacy tool usage message (backward compatibility)
   * @param progress Progress message with tool usage data
   * @returns Formatted tool usage message
   */
  static formatLegacyToolUsage(progress: ProgressMessage): string {
    const toolData = progress.data;
    if (!toolData) {
      return progress.message || "";
    }

    const toolStatus =
      toolData.status === "success" ? "✓" : toolData.status === "failure" ? "✗" : "⚡";

    if (toolData.tool === "bash") {
      return `[Bash] ${toolStatus} ${toolData.command || ""}`;
    } else if (toolData.tool === "read") {
      return `[Read] ${toolStatus} ${toolData.filePath || ""}`;
    } else if (toolData.tool === "write" || toolData.tool === "edit") {
      return `[${toolData.tool}] ${toolStatus} ${toolData.filePath || ""}`;
    } else {
      let message = `[${toolData.tool}] ${toolStatus} ${
        toolData.status === "start" ? "開始" : toolData.status === "success" ? "成功" : "失敗"
      }`;
      if (toolData.filePath) message += `: ${toolData.filePath}`;
      else if (toolData.command) message += `: ${toolData.command}`;
      else if (toolData.pattern) message += `: ${toolData.pattern}`;
      return message;
    }
  }

  /**
   * Format Claude response message
   * @param message Response message from Claude
   * @returns Formatted Claude response
   */
  static formatClaudeResponse(message: string): string {
    return `💬 Claude: ${message}`;
  }

  /**
   * Format TODO update message
   * @param message TODO update message
   * @returns Formatted TODO update
   */
  static formatTodoUpdate(message: string): string {
    return `📝 TODO: ${message}`;
  }

  /**
   * Format general progress message
   * @param message Progress message
   * @returns Formatted progress message
   */
  static formatProgress(message: string): string {
    return `⏳ ${message}`;
  }

  /**
   * Format statistics message
   * @param message Statistics message
   * @returns Formatted statistics
   */
  static formatStatistics(message: string): string {
    return `📊 ${message}`;
  }

  /**
   * Format error message
   * @param error Error object or message
   * @returns Formatted error message
   */
  static formatError(error: unknown): string {
    if (error instanceof Error) {
      return `❌ Error: ${error.message}`;
    }
    return `❌ Error: ${String(error)}`;
  }

  /**
   * Format success message
   * @param message Success message
   * @returns Formatted success message
   */
  static formatSuccess(message: string): string {
    return `✅ ${message}`;
  }

  /**
   * Format warning message
   * @param message Warning message
   * @returns Formatted warning message
   */
  static formatWarning(message: string): string {
    return `⚠️ ${message}`;
  }

  /**
   * Format info message
   * @param message Info message
   * @returns Formatted info message
   */
  static formatInfo(message: string): string {
    return `ℹ️ ${message}`;
  }

  /**
   * Format debug message
   * @param message Debug message
   * @returns Formatted debug message
   */
  static formatDebug(message: string): string {
    return `🔍 Debug: ${message}`;
  }
}
