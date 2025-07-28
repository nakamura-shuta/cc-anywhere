import type { ToolUsageDetail, TaskProgressInfo, TaskSummary } from "../types/enhanced-logging.js";
import type { TodoItem } from "../types/todo.js";
import { logger } from "../utils/logger.js";

/**
 * TaskTracker collects and analyzes task execution information
 * to provide detailed insights and summaries
 */
export class TaskTracker {
  private startTime: Date;
  private toolUsages: ToolUsageDetail[] = [];
  private progressLogs: TaskProgressInfo[] = [];
  private errors: Array<{ message: string; tool?: string; timestamp: Date }> = [];
  private todos: TodoItem[] = [];

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Record tool usage
   */
  recordToolUsage(detail: Omit<ToolUsageDetail, "timestamp">): void {
    const toolUsage = {
      ...detail,
      timestamp: new Date(),
    };
    this.toolUsages.push(toolUsage);

    // Debug log
    logger.debug("Recording tool usage", {
      tool: toolUsage.tool,
      status: toolUsage.status,
      action: detail.action || "unknown",
      totalUsages: this.toolUsages.length,
    });
  }

  /**
   * Record task progress
   */
  recordProgress(info: Omit<TaskProgressInfo, "timestamp">): void {
    this.progressLogs.push({
      ...info,
      timestamp: new Date(),
    });
  }

  /**
   * Record error
   */
  recordError(error: string, tool?: string): void {
    this.errors.push({
      message: error,
      tool,
      timestamp: new Date(),
    });
  }

  /**
   * Update todos
   */
  updateTodos(todos: TodoItem[]): void {
    this.todos = todos.map((todo) => ({
      ...todo,
      updatedAt: new Date(),
    }));
  }

  /**
   * Get current todos
   */
  getTodos(): TodoItem[] {
    return this.todos;
  }

  /**
   * Extract tool details from Claude Code SDK message
   */
  extractToolDetails(message: any): ToolUsageDetail | null {
    if (!message || typeof message !== "object") return null;

    // Handle tool_result messages
    if (message.type === "tool_result" && message.tool) {
      const status = message.subtype === "success" ? "success" : "failure";
      const detail: ToolUsageDetail = {
        tool: message.tool,
        status,
        timestamp: new Date(),
      };

      // Extract input details
      if (message.input && typeof message.input === "object") {
        const input = message.input as Record<string, any>;

        switch (message.tool) {
          case "Read":
          case "Write":
          case "Edit":
          case "MultiEdit":
            detail.filePath = input.file_path || input.path;
            break;
          case "Bash":
            detail.command = input.command;
            break;
          case "Glob":
          case "Grep":
            detail.pattern = input.pattern;
            detail.filePath = input.path;
            break;
          case "WebFetch":
          case "WebSearch":
            detail.url = input.url || input.query;
            break;
        }
      }

      // Extract error message if failed
      if (status === "failure" && message.result) {
        if (typeof message.result === "string") {
          detail.error = message.result;
        } else if (message.result.error) {
          detail.error = message.result.error;
        }
      }

      return detail;
    }

    // Handle tool_use messages (when tool is starting)
    if (message.type === "text" && message.message?.content) {
      for (const content of message.message.content) {
        if (content.type === "tool_use" && content.tool_use?.name) {
          const detail: ToolUsageDetail = {
            tool: content.tool_use.name,
            status: "start",
            timestamp: new Date(),
          };

          // Extract input details
          if (content.tool_use.input && typeof content.tool_use.input === "object") {
            const input = content.tool_use.input as Record<string, any>;

            switch (content.tool_use.name) {
              case "Write":
              case "Read":
              case "Edit":
                detail.filePath = input.file_path;
                break;
              case "Bash":
                detail.command = input.command;
                break;
              case "TodoWrite":
                if (input.todos) {
                  detail.todoCount = input.todos.length;
                }
                break;
            }
          }

          return detail;
        }
      }
    }

    return null;
  }

  /**
   * Generate task summary
   */
  generateSummary(success: boolean, _output?: any): TaskSummary {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();

    // Aggregate tool usage statistics
    const toolStats = new Map<
      string,
      {
        count: number;
        successCount: number;
        failureCount: number;
        details: Set<string>;
      }
    >();

    const filesModified = new Set<string>();
    const filesRead = new Set<string>();
    const filesCreated = new Set<string>();
    const commandsExecuted: Array<{ command: string; success: boolean }> = [];

    for (const usage of this.toolUsages) {
      // Update tool stats
      if (!toolStats.has(usage.tool)) {
        toolStats.set(usage.tool, {
          count: 0,
          successCount: 0,
          failureCount: 0,
          details: new Set(),
        });
      }
      const stats = toolStats.get(usage.tool)!;

      if (usage.status !== "start") {
        stats.count++;
        if (usage.status === "success") {
          stats.successCount++;
        } else {
          stats.failureCount++;
        }
      }

      // Collect file and command information
      switch (usage.tool) {
        case "Write":
          if (usage.filePath && usage.status === "success") {
            filesCreated.add(usage.filePath);
            stats.details.add(usage.filePath);
          }
          break;
        case "Edit":
        case "MultiEdit":
          if (usage.filePath && usage.status === "success") {
            filesModified.add(usage.filePath);
            stats.details.add(usage.filePath);
          }
          break;
        case "Read":
          if (usage.filePath && usage.status === "success") {
            filesRead.add(usage.filePath);
            stats.details.add(usage.filePath);
          }
          break;
        case "Bash":
          if (usage.command && usage.status !== "start") {
            commandsExecuted.push({
              command: usage.command,
              success: usage.status === "success",
            });
            stats.details.add(usage.command);
          }
          break;
        case "Glob":
        case "Grep":
          if (usage.pattern) {
            stats.details.add(usage.pattern);
          }
          break;
      }
    }

    // Convert tool stats to array
    const toolsUsed = Array.from(toolStats.entries()).map(([tool, stats]) => ({
      tool,
      count: stats.count,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      details: Array.from(stats.details).slice(0, 5), // Limit to 5 examples
    }));

    // Determine outcome
    let outcome: "success" | "partial_success" | "failure";
    if (success && this.errors.length === 0) {
      outcome = "success";
    } else if (success || toolsUsed.some((t) => t.successCount > 0)) {
      outcome = "partial_success";
    } else {
      outcome = "failure";
    }

    // Generate highlights
    const highlights = this.generateHighlights(
      filesCreated,
      filesModified,
      filesRead,
      commandsExecuted,
      toolsUsed,
    );

    return {
      totalDuration,
      toolsUsed,
      filesModified: Array.from(filesModified),
      filesRead: Array.from(filesRead),
      filesCreated: Array.from(filesCreated),
      commandsExecuted,
      errors: this.errors,
      outcome,
      highlights,
    };
  }

  /**
   * Generate task highlights
   */
  private generateHighlights(
    filesCreated: Set<string>,
    filesModified: Set<string>,
    filesRead: Set<string>,
    commandsExecuted: Array<{ command: string; success: boolean }>,
    toolsUsed: any[],
  ): string[] {
    const highlights: string[] = [];

    // File operations
    if (filesCreated.size > 0) {
      highlights.push(`${filesCreated.size}個のファイルを作成`);
    }
    if (filesModified.size > 0) {
      highlights.push(`${filesModified.size}個のファイルを編集`);
    }
    if (filesRead.size > 0) {
      highlights.push(`${filesRead.size}個のファイルを読み込み`);
    }

    // Command executions
    const successfulCommands = commandsExecuted.filter((c) => c.success);
    if (successfulCommands.length > 0) {
      highlights.push(`${successfulCommands.length}個のコマンドを実行`);
    }

    // Tool usage summary
    const totalTools = toolsUsed.reduce((sum, t) => sum + t.count, 0);
    if (totalTools > 0) {
      const successRate = Math.round(
        (toolsUsed.reduce((sum, t) => sum + t.successCount, 0) / totalTools) * 100,
      );
      highlights.push(`${totalTools}回のツール実行（成功率: ${successRate}%）`);
    }

    // Error summary
    if (this.errors.length > 0) {
      highlights.push(`${this.errors.length}個のエラーが発生`);
    }

    // Duration
    const duration = Math.round((new Date().getTime() - this.startTime.getTime()) / 1000);
    highlights.push(`実行時間: ${duration}秒`);

    return highlights;
  }

  /**
   * Get task statistics
   */
  getStatistics(): {
    totalToolUsage: number;
    toolUsageByType: Map<string, { count: number; successCount: number; failureCount: number }>;
  } {
    const toolUsageByType = new Map<
      string,
      { count: number; successCount: number; failureCount: number }
    >();

    let totalToolUsage = 0;

    // Debug log
    logger.debug("Calculating statistics", {
      totalRecords: this.toolUsages.length,
      records: this.toolUsages.map((u) => ({ tool: u.tool, status: u.status })),
    });

    for (const usage of this.toolUsages) {
      if (usage.status !== "start") {
        totalToolUsage++;

        if (!toolUsageByType.has(usage.tool)) {
          toolUsageByType.set(usage.tool, {
            count: 0,
            successCount: 0,
            failureCount: 0,
          });
        }

        const stats = toolUsageByType.get(usage.tool)!;
        stats.count++;

        if (usage.status === "success") {
          stats.successCount++;
        } else if (usage.status === "failure") {
          stats.failureCount++;
        }
      }
    }

    logger.debug("Statistics calculated", {
      totalToolUsage,
      toolTypes: Array.from(toolUsageByType.entries()),
    });

    return {
      totalToolUsage,
      toolUsageByType,
    };
  }
}
