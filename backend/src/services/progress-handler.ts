import { logger } from "../utils/logger.js";
import { FormattingHelpers } from "../utils/formatting-helpers.js";
import { ErrorHandlers } from "../utils/error-handlers.js";
import type { WebSocketBroadcaster } from "../websocket/websocket-broadcaster.js";

/**
 * Minimal repository interface for progress handling
 * Works with both ITaskRepository and TaskRepositoryAdapter
 */
interface ProgressRepository {
  updateProgressData(id: string, progressData: unknown): Promise<void> | void;
}

/**
 * Progress data structure
 */
export interface ProgressData {
  currentTurn: number;
  maxTurns?: number;
  toolUsageCount: Record<string, number>;
  statistics: {
    totalToolCalls: number;
    processedFiles: number;
    createdFiles: number;
    modifiedFiles: number;
    totalExecutions: number;
    tokenUsage?: { input: number; output: number; cached?: number };
  };
  todos: any[];
  toolExecutions: any[];
  claudeResponses: any[];
}

/**
 * タスク進捗処理の統一ハンドラー
 *
 * タスクの進捗イベント（10種類）を統一的に処理します。
 * - ProgressData更新
 * - WebSocket配信
 * - データベース永続化
 * - ログメッセージ生成
 */
export class ProgressHandler {
  constructor(
    private taskId: string,
    private broadcaster?: WebSocketBroadcaster,
    private repository?: ProgressRepository,
  ) {}

  /**
   * 進捗イベントを処理
   *
   * @param progress - 進捗イベント
   * @param progressData - 進捗データ
   * @returns フォーマット済みログメッセージ
   *
   * @example
   * ```typescript
   * const handler = new ProgressHandler(taskId, broadcaster, repository);
   * const logMessage = await handler.handleProgress(progress, progressData);
   * ```
   */
  async handleProgress(
    progress: { type: string; message: string; data?: any },
    progressData: ProgressData,
  ): Promise<string | null> {
    const timestamp = Date.now();

    switch (progress.type) {
      case "log":
        return this.handleLogProgress(progress, timestamp);
      case "tool_usage":
        return this.handleToolUsageProgress(progress, timestamp);
      case "progress":
        return this.handleGeneralProgress(progress, timestamp);
      case "summary":
        return this.handleSummaryProgress(progress, timestamp);
      case "todo_update":
        return await this.handleTodoUpdateProgress(progress, timestamp, progressData);
      case "tool:start":
        return await this.handleToolStartProgress(progress, timestamp, progressData);
      case "tool:end":
        return await this.handleToolEndProgress(progress, timestamp, progressData);
      case "claude:response":
        return await this.handleClaudeResponseProgress(progress, timestamp, progressData);
      case "reasoning":
        return this.handleReasoningProgress(progress, timestamp);
      case "statistics":
        return await this.handleStatisticsProgress(progress, timestamp, progressData);
      default:
        return this.handleUnknownProgress(progress, timestamp);
    }
  }

  /**
   * ログ進捗処理
   */
  private handleLogProgress(progress: any, timestamp: number): string {
    this.broadcaster?.task(this.taskId, "task:log", {
      message: progress.message,
      timestamp,
    });
    return progress.message;
  }

  /**
   * ツール使用進捗処理
   */
  private handleToolUsageProgress(progress: any, timestamp: number): string {
    this.broadcaster?.task(this.taskId, "task:tool_usage", {
      message: progress.message,
      timestamp,
    });
    return progress.message;
  }

  /**
   * 一般進捗処理
   */
  private handleGeneralProgress(progress: any, timestamp: number): string {
    this.broadcaster?.task(this.taskId, "task:progress", {
      message: progress.message,
      timestamp,
    });
    return progress.message;
  }

  /**
   * サマリー進捗処理
   */
  private handleSummaryProgress(progress: any, timestamp: number): string {
    this.broadcaster?.task(this.taskId, "task:summary", {
      message: progress.message,
      timestamp,
    });
    return progress.message;
  }

  /**
   * TODO更新処理
   */
  private async handleTodoUpdateProgress(
    progress: any,
    timestamp: number,
    progressData: ProgressData,
  ): Promise<string> {
    const todoList = progress.data?.todos
      ? progress.data.todos
          .map((t: any) => `${t.status === "completed" ? "✅" : "⏳"} ${t.content}`)
          .join("\n")
      : "";

    // progressData更新
    progressData.todos = progress.data?.todos || [];

    // DB保存
    try {
      await this.repository?.updateProgressData(this.taskId, progressData);
    } catch (error) {
      await ErrorHandlers.handleDatabaseError(
        "update progress data",
        { taskId: this.taskId },
        error,
      );
    }

    // WebSocket配信
    this.broadcaster?.task(this.taskId, "task:todo_update", {
      todos: progress.data?.todos || [],
      timestamp,
    });

    // ログメッセージ生成
    return `📝 TODO更新\n${todoList}\n${FormattingHelpers.formatJapaneseTimestamp(timestamp)}`;
  }

  /**
   * ツール開始処理
   */
  private async handleToolStartProgress(
    progress: any,
    timestamp: number,
    progressData: ProgressData,
  ): Promise<string> {
    const toolName = progress.data.tool;

    // progressData更新
    progressData.toolUsageCount[toolName] = (progressData.toolUsageCount[toolName] || 0) + 1;
    progressData.toolExecutions.push({
      type: "start",
      tool: toolName,
      timestamp,
      args: progress.data.input,
    });

    // DB保存
    try {
      await this.repository?.updateProgressData(this.taskId, progressData);
    } catch (error) {
      await ErrorHandlers.handleDatabaseError(
        "update progress data",
        { taskId: this.taskId },
        error,
      );
    }

    // WebSocket配信
    this.broadcaster?.task(this.taskId, "task:tool:start", {
      toolId: progress.data.toolId || `${toolName}-${Date.now()}`,
      tool: toolName,
      input: progress.data.input,
      formattedInput: progress.data.formattedInput,
      timestamp,
    });

    // ログメッセージ生成
    const displayInput = progress.data.formattedInput ? `: ${progress.data.formattedInput}` : "";
    return `${progress.data.tool}\n${FormattingHelpers.formatJapaneseTimestamp(timestamp)}${displayInput}`;
  }

  /**
   * ツール終了処理
   */
  private async handleToolEndProgress(
    progress: any,
    timestamp: number,
    progressData: ProgressData,
  ): Promise<string> {
    const toolName = progress.data.tool;
    const duration = progress.data.duration;

    // progressData更新
    progressData.toolExecutions.push({
      type: "end",
      tool: toolName,
      timestamp,
      duration,
      success: !progress.data.error,
      result: progress.data.output,
      error: progress.data.error,
    });

    // DB保存
    try {
      await this.repository?.updateProgressData(this.taskId, progressData);
    } catch (error) {
      await ErrorHandlers.handleDatabaseError(
        "update progress data",
        { taskId: this.taskId },
        error,
      );
    }

    // WebSocket配信
    this.broadcaster?.task(this.taskId, "task:tool:end", {
      toolId: progress.data.toolId || `${toolName}-${Date.now()}`,
      tool: toolName,
      output: progress.data.output,
      duration,
      success: !progress.data.error,
      timestamp,
    });

    // ログメッセージ生成
    const status = progress.data.error ? "❌ エラー" : "✅ 成功";
    const durationStr = duration ? FormattingHelpers.formatDuration(duration) : "";
    return `${status}\n${progress.data.tool}${durationStr}\n${FormattingHelpers.formatJapaneseTimestamp(timestamp)}`;
  }

  /**
   * Claude応答処理
   */
  private async handleClaudeResponseProgress(
    progress: any,
    timestamp: number,
    progressData: ProgressData,
  ): Promise<string> {
    const text = progress.message || progress.data?.text || "";
    const turnNumber = progress.data?.turnNumber;

    // progressData更新
    progressData.claudeResponses.push({
      turnNumber,
      text,
      timestamp,
    });

    // DB保存
    try {
      await this.repository?.updateProgressData(this.taskId, progressData);
    } catch (error) {
      await ErrorHandlers.handleDatabaseError(
        "update progress data",
        { taskId: this.taskId },
        error,
      );
    }

    // WebSocket配信
    this.broadcaster?.task(this.taskId, "task:claude_response", {
      text,
      turnNumber,
      timestamp,
    });

    // ログメッセージ生成
    const turnInfo = turnNumber !== undefined ? ` (Turn ${turnNumber})` : "";
    const responseText = text.length > 100 ? `${text.substring(0, 100)}...` : text;
    return `${FormattingHelpers.formatJapaneseTimestamp(timestamp)}${turnInfo}\n${responseText}`;
  }

  /**
   * Reasoning進捗処理 (Codex SDK v0.52.0+)
   */
  private handleReasoningProgress(progress: any, timestamp: number): string {
    const id = progress.data?.id || "";
    const text = progress.message || progress.data?.text || "";

    // WebSocket配信
    this.broadcaster?.task(this.taskId, "task:reasoning", {
      id,
      text,
      timestamp,
    });

    // ログメッセージ生成（reasoning textは通常長いので最初の100文字のみ）
    const reasoningText = text.length > 100 ? `${text.substring(0, 100)}...` : text;
    return `💭 Reasoning\n${reasoningText}\n${FormattingHelpers.formatJapaneseTimestamp(timestamp)}`;
  }

  /**
   * 統計情報処理
   */
  private async handleStatisticsProgress(
    progress: any,
    timestamp: number,
    progressData: ProgressData,
  ): Promise<string> {
    const stats = progress.data || {};

    // progressData更新
    progressData.statistics = {
      ...progressData.statistics,
      ...stats,
    };

    // DB保存
    try {
      await this.repository?.updateProgressData(this.taskId, progressData);
    } catch (error) {
      await ErrorHandlers.handleDatabaseError(
        "update progress data",
        { taskId: this.taskId },
        error,
      );
    }

    // WebSocket配信
    this.broadcaster?.task(this.taskId, "task:statistics", {
      ...stats,
      timestamp,
    });

    // ログメッセージ生成（統計情報は簡潔に）
    const lines = [];
    if (stats.totalTurns !== undefined) lines.push(`総ターン数: ${stats.totalTurns}`);
    if (stats.totalToolCalls !== undefined) lines.push(`総ツール呼び出し: ${stats.totalToolCalls}`);
    if (stats.tokenUsage) {
      lines.push(
        `トークン使用量: ${stats.tokenUsage.input} input + ${stats.tokenUsage.output} output`,
      );
    }
    return lines.length > 0 ? `📊 統計情報\n${lines.join("\n")}` : "📊 統計情報";
  }

  /**
   * 未知のイベントタイプ処理
   */
  private handleUnknownProgress(progress: any, timestamp: number): string {
    logger.debug("Unknown progress event type", {
      type: progress.type,
      taskId: this.taskId,
    });

    // 一般的な進捗イベントとして処理
    this.broadcaster?.task(this.taskId, "task:progress", {
      message: progress.message,
      timestamp,
    });

    return progress.message || "";
  }
}
