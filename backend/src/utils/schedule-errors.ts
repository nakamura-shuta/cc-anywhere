import { NotFoundError, ValidationError, AppError } from "./errors.js";

/**
 * スケジュールが見つからない場合のエラー
 */
export class ScheduleNotFoundError extends NotFoundError {
  constructor(scheduleId: string) {
    super(`Schedule ${scheduleId} not found`);
    this.name = "ScheduleNotFoundError";
    this.code = "SCHEDULE_NOT_FOUND";
    this.details = { scheduleId };
  }
}

/**
 * スケジュールが不正な場合のエラー
 */
export class InvalidScheduleError extends ValidationError {
  constructor(message: string, field?: string) {
    super(message);
    this.name = "InvalidScheduleError";
    this.code = "INVALID_SCHEDULE";
    if (field) {
      this.details = { field };
    }
  }
}

/**
 * Cron表現が不正な場合のエラー
 */
export class InvalidCronExpressionError extends ValidationError {
  constructor(cronExpression: string) {
    super(`Invalid cron expression: ${cronExpression}`);
    this.name = "InvalidCronExpressionError";
    this.code = "INVALID_CRON";
    this.details = { cronExpression };
  }
}

/**
 * スケジュール実行エラー
 */
export class ScheduleExecutionError extends AppError {
  constructor(message: string, scheduleId: string, details?: any) {
    super(message, 500, "SCHEDULE_EXECUTION_ERROR", {
      scheduleId,
      ...details,
    });
    this.name = "ScheduleExecutionError";
  }
}
