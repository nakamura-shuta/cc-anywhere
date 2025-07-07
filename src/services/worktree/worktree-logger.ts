import type { Logger } from "winston";
import winston from "winston";
import type { WorktreeLogEntry } from "./types";

/**
 * Worktree操作の詳細ログを管理するクラス
 */
export class WorktreeLogger {
  private logger: Logger;
  private logBuffer: WorktreeLogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(loggerName = "WorktreeManager") {
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: loggerName },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  /**
   * ログエントリを記録
   */
  log(entry: Omit<WorktreeLogEntry, "timestamp">): void {
    const logEntry: WorktreeLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    // バッファに追加
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Winstonロガーに出力
    const logMethod = this.getLogMethod(entry.level);
    logMethod(`[${entry.operation}] ${entry.message}`, {
      taskId: entry.taskId,
      worktreeId: entry.worktreeId,
      details: entry.details,
    });
  }

  /**
   * 操作の開始をログ
   */
  logOperationStart(
    operation: string,
    taskId?: string,
    worktreeId?: string,
    details?: Record<string, any>,
  ): void {
    this.log({
      level: "info",
      operation,
      taskId,
      worktreeId,
      message: `Starting ${operation}`,
      details: {
        ...details,
        startTime: new Date().toISOString(),
      },
    });
  }

  /**
   * 操作の成功をログ
   */
  logOperationSuccess(
    operation: string,
    taskId?: string,
    worktreeId?: string,
    details?: Record<string, any>,
  ): void {
    this.log({
      level: "info",
      operation,
      taskId,
      worktreeId,
      message: `${operation} completed successfully`,
      details: {
        ...details,
        endTime: new Date().toISOString(),
      },
    });
  }

  /**
   * 操作のエラーをログ
   */
  logOperationError(
    operation: string,
    error: Error | string,
    taskId?: string,
    worktreeId?: string,
    details?: Record<string, any>,
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;

    this.log({
      level: "error",
      operation,
      taskId,
      worktreeId,
      message: `${operation} failed: ${errorMessage}`,
      details,
      stackTrace,
    });
  }

  /**
   * 警告をログ
   */
  logWarning(
    operation: string,
    message: string,
    taskId?: string,
    worktreeId?: string,
    details?: Record<string, any>,
  ): void {
    this.log({
      level: "warn",
      operation,
      taskId,
      worktreeId,
      message,
      details,
    });
  }

  /**
   * デバッグ情報をログ
   */
  logDebug(
    operation: string,
    message: string,
    taskId?: string,
    worktreeId?: string,
    details?: Record<string, any>,
  ): void {
    this.log({
      level: "debug",
      operation,
      taskId,
      worktreeId,
      message,
      details,
    });
  }

  /**
   * クリティカルエラーをログ
   */
  logCritical(
    operation: string,
    message: string,
    error?: Error,
    taskId?: string,
    worktreeId?: string,
    details?: Record<string, any>,
  ): void {
    this.log({
      level: "critical",
      operation,
      taskId,
      worktreeId,
      message,
      details,
      stackTrace: error?.stack,
    });
  }

  /**
   * Worktree作成の詳細ログ
   */
  logWorktreeCreation(
    taskId: string,
    worktreeId: string,
    config: {
      repositoryPath: string;
      worktreePath: string;
      baseBranch: string;
      targetBranch: string;
    },
  ): void {
    this.logOperationStart("WORKTREE_CREATE", taskId, worktreeId, {
      repository: config.repositoryPath,
      worktreePath: config.worktreePath,
      baseBranch: config.baseBranch,
      targetBranch: config.targetBranch,
      diskSpaceBefore: this.getDiskSpace(config.repositoryPath),
    });
  }

  /**
   * Worktree削除の詳細ログ
   */
  logWorktreeDeletion(
    taskId: string,
    worktreeId: string,
    worktreePath: string,
    force: boolean,
  ): void {
    this.logOperationStart("WORKTREE_DELETE", taskId, worktreeId, {
      worktreePath,
      force,
      diskSpaceBefore: this.getDiskSpace(worktreePath),
    });
  }

  /**
   * クリーンアップの詳細ログ
   */
  logCleanupStart(
    operation: string,
    details: {
      worktreeCount?: number;
      orphanedCount?: number;
      reason?: string;
    },
  ): void {
    this.logOperationStart(`CLEANUP_${operation.toUpperCase()}`, undefined, undefined, details);
  }

  /**
   * ログバッファを取得
   */
  getLogBuffer(filter?: {
    taskId?: string;
    worktreeId?: string;
    level?: WorktreeLogEntry["level"];
    operation?: string;
    startTime?: Date;
    endTime?: Date;
  }): WorktreeLogEntry[] {
    if (!filter) {
      return [...this.logBuffer];
    }

    return this.logBuffer.filter((entry) => {
      if (filter.taskId && entry.taskId !== filter.taskId) return false;
      if (filter.worktreeId && entry.worktreeId !== filter.worktreeId) return false;
      if (filter.level && entry.level !== filter.level) return false;
      if (filter.operation && entry.operation !== filter.operation) return false;
      if (filter.startTime && entry.timestamp < filter.startTime) return false;
      if (filter.endTime && entry.timestamp > filter.endTime) return false;
      return true;
    });
  }

  /**
   * ログバッファをクリア
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * ログレベルに応じたログメソッドを取得
   */
  private getLogMethod(level: WorktreeLogEntry["level"]): Logger["info"] {
    switch (level) {
      case "debug":
        return this.logger.debug.bind(this.logger);
      case "info":
        return this.logger.info.bind(this.logger);
      case "warn":
        return this.logger.warn.bind(this.logger);
      case "error":
        return this.logger.error.bind(this.logger);
      case "critical":
        return this.logger.error.bind(this.logger); // Winstonにはcriticalがないのでerrorを使用
      default:
        return this.logger.info.bind(this.logger);
    }
  }

  /**
   * ディスク容量を取得（簡易実装）
   */
  private getDiskSpace(_path: string): string {
    // TODO: 実際のディスク容量チェックを実装
    return "unknown";
  }
}
