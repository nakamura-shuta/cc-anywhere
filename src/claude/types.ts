import type { TimeoutConfig } from "../types/timeout.js";
import type { WorktreeOptions } from "../services/worktree/types.js";

// Retry policy types
export enum RetryPolicy {
  NONE = "none",
  EXPONENTIAL = "exponential",
  LINEAR = "linear",
}

// Retry configuration
export interface RetryConfig {
  maxRetries?: number; // Maximum number of retry attempts (default: 3)
  initialDelay?: number; // Initial delay in ms (default: 1000)
  maxDelay?: number; // Maximum delay in ms (default: 60000)
  backoffMultiplier?: number; // Multiplier for exponential backoff (default: 2)
  retryableErrors?: string[]; // Error codes/messages that should trigger retry
  policy?: RetryPolicy; // Retry policy (default: exponential)
}

// Task context type
export interface TaskContext {
  workingDirectory?: string;
  files?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Task request type
export interface TaskRequest {
  instruction: string;
  context?: TaskContext;
  options?: {
    timeout?: number | TimeoutConfig;
    async?: boolean;
    allowedTools?: string[];
    retry?: RetryConfig; // Retry configuration
    onProgress?: (progress: { type: string; message: string }) => void | Promise<void>; // Progress callback
    // Worktree options
    useWorktree?: boolean; // Simple flag to enable worktree
    worktree?: WorktreeOptions; // Detailed worktree configuration
  };
}

// Task status enum
export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

// Retry attempt metadata
export interface RetryAttempt {
  attemptNumber: number;
  startedAt: Date;
  completedAt: Date;
  error: {
    message: string;
    code?: string;
  };
  delay?: number; // Delay before this attempt in ms
}

// Task response
export interface TaskResponse {
  taskId: string;
  status: TaskStatus;
  instruction: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
  };
  logs?: string[];
  retryMetadata?: {
    currentAttempt: number;
    maxRetries: number;
    retryHistory: RetryAttempt[];
    nextRetryAt?: Date; // When the next retry is scheduled
  };
  allowedTools?: string[];
  workingDirectory?: string;
  repositoryName?: string;
  groupId?: string;
}

// Claude execution result
export interface ClaudeExecutionResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  logs: string[];
  duration: number;
}

// Task result type alias
export type TaskResult = ClaudeExecutionResult;

// Task executor interface
export interface TaskExecutor {
  execute(
    task: TaskRequest,
    taskId?: string,
    retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult>;
  cancel(taskId: string): Promise<void>;
}
