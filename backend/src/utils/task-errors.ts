import { NotFoundError, AppError, ValidationError, SystemError } from "./errors.js";

/**
 * タスクが見つからない場合のエラー
 */
export class TaskNotFoundError extends NotFoundError {
  constructor(taskId: string) {
    super(`Task ${taskId} not found`);
    this.name = "TaskNotFoundError";
    this.code = "TASK_NOT_FOUND";
    this.details = { taskId };
  }
}

/**
 * タスクリクエストが不正な場合のエラー
 */
export class InvalidTaskRequestError extends ValidationError {
  constructor(message: string, field?: string) {
    super(message);
    this.name = "InvalidTaskRequestError";
    this.code = "INVALID_TASK_REQUEST";
    if (field) {
      this.details = { field };
    }
  }
}

/**
 * タスク実行中のエラー
 */
export class TaskExecutionError extends AppError {
  constructor(message: string, taskId: string, originalError?: Error) {
    super(message, 500, "TASK_EXECUTION_ERROR", {
      taskId,
      originalError: originalError?.message,
    });
    this.name = "TaskExecutionError";
  }
}

/**
 * タスクキャンセル時のエラー
 */
export class TaskCancellationError extends AppError {
  constructor(taskId: string, reason?: string) {
    super(reason || `Task ${taskId} cancellation failed`, 500, "TASK_CANCELLATION_ERROR", {
      taskId,
      reason,
    });
    this.name = "TaskCancellationError";
  }
}

/**
 * ワーカーが利用できない場合のエラー
 */
export class WorkerNotAvailableError extends SystemError {
  constructor(message: string = "No workers available") {
    super(message);
    this.name = "WorkerNotAvailableError";
    this.code = "WORKER_NOT_AVAILABLE";
  }
}

/**
 * バッチタスクのエラー
 */
export class BatchTaskError extends AppError {
  constructor(message: string, failedTasks: Array<{ taskId: string; error: string }>) {
    super(message, 500, "BATCH_TASK_ERROR", { failedTasks });
    this.name = "BatchTaskError";
  }
}

/**
 * セッションが見つからない場合のエラー
 */
export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`);
    this.name = "SessionNotFoundError";
    this.code = "SESSION_NOT_FOUND";
    this.details = { sessionId };
  }
}

/**
 * リポジトリが見つからない場合のエラー
 */
export class RepositoryNotFoundError extends NotFoundError {
  constructor(repositoryName: string) {
    super(`Repository ${repositoryName} not found`);
    this.name = "RepositoryNotFoundError";
    this.code = "REPOSITORY_NOT_FOUND";
    this.details = { repositoryName };
  }
}

/**
 * プリセットが見つからない場合のエラー
 */
export class PresetNotFoundError extends NotFoundError {
  constructor(presetId: string) {
    super(`Preset ${presetId} not found`);
    this.name = "PresetNotFoundError";
    this.code = "PRESET_NOT_FOUND";
    this.details = { presetId };
  }
}

/**
 * プリセットが不正な場合のエラー
 */
export class InvalidPresetError extends ValidationError {
  constructor(message: string, presetId?: string) {
    super(message);
    this.name = "InvalidPresetError";
    this.code = "INVALID_PRESET";
    if (presetId) {
      this.details = { presetId };
    }
  }
}
