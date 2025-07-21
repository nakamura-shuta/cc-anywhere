/**
 * 基底エラークラス
 * すべてのアプリケーションエラーはこのクラスを継承する
 */
export class AppError extends Error {
  public readonly timestamp: Date;

  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "AppError";
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * エラーをJSON形式で出力
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * エラーの文字列表現
   */
  toString(): string {
    return `${this.name}: ${this.message} (code: ${this.code || "N/A"})`;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
  }
}

export class TaskCancelledError extends AppError {
  constructor(message: string = "Task was cancelled") {
    super(message, 499, "TASK_CANCELLED");
    this.name = "TaskCancelledError";
  }
}

export class SystemError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 500, "SYSTEM_ERROR", details);
    this.name = "SystemError";
  }
}

/**
 * 共通のエラーレスポンス構造
 */
export interface ErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, any>;
  timestamp?: Date | string;
  stack?: string;
}
