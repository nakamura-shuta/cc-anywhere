import type { TimeoutOptions } from "../types/timeout.js";
import type { WorktreeOptions } from "../services/worktree/types.js";
import type { TodoItem } from "../types/todo.js";

// Retry policy types
export enum RetryPolicy {
  NONE = "none",
  EXPONENTIAL = "exponential",
  LINEAR = "linear",
}

// Retry options for task execution
export interface RetryOptions {
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

/**
 * Configuration for web search functionality
 */
export interface WebSearchConfig {
  maxResults?: number;
  searchEngine?: string;
  timeout?: number;
}

// Task request type
// MCP Server configuration
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

// Claude Code SDK specific options
export interface ClaudeCodeSDKOptions {
  // Priority: High
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  permissionMode?: "ask" | "allow" | "deny" | "acceptEdits" | "bypassPermissions" | "plan";

  // Priority: Medium
  executable?: "node" | "bun" | "deno";
  executableArgs?: string[];
  mcpConfig?: Record<string, MCPServerConfig>;
  continueSession?: boolean;
  resumeSession?: string;
  outputFormat?: "text" | "json" | "stream-json";

  // Priority: Low
  verbose?: boolean;
  permissionPromptTool?: string;
  pathToClaudeCodeExecutable?: string;

  // Web search options
  enableWebSearch?: boolean;
  webSearchConfig?: WebSearchConfig;
}

export interface TaskRequest {
  instruction: string;
  context?: TaskContext;
  options?: {
    timeout?: number | TimeoutOptions;
    async?: boolean;
    allowedTools?: string[]; // 後方互換性のため残す
    retry?: RetryOptions; // Retry options
    onProgress?: (progress: { type: string; message: string }) => void | Promise<void>; // Progress callback
    // Worktree options
    useWorktree?: boolean; // Simple flag to enable worktree
    worktree?: WorktreeOptions; // Detailed worktree configuration
    // Claude Code SDK options
    sdk?: ClaudeCodeSDKOptions;
    // Cross-repository continuation
    allowCrossRepository?: boolean; // Allow continuation in different repository
  };
}

// Task status enum
export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  SCHEDULED = "scheduled", // スケジュール待機中
  DELAYED = "delayed", // 遅延実行待機中
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
  todos?: TodoItem[];
  continuedFrom?: string;
  progressData?: {
    currentTurn?: number;
    maxTurns?: number;
    toolUsageCount?: Record<string, number>;
    statistics?: {
      totalToolCalls?: number;
      processedFiles?: number;
      createdFiles?: number;
      modifiedFiles?: number;
      totalExecutions?: number;
    };
    todos?: TodoItem[];
  };
}

/**
 * Result of Claude task execution
 */
export interface ClaudeExecutionResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Task output (structure depends on execution mode) */
  output?: unknown;
  /** Error if task failed */
  error?: Error;
  /** Execution logs collected during task run */
  logs: string[];
  /** Total execution duration in milliseconds */
  duration: number;
  /** Tools used during execution */
  toolsUsed?: string[];
  /** Files modified during execution */
  filesModified?: string[];
  /** Todo items from TodoWrite tool */
  todos?: TodoItem[];
  /** Conversation history (SDK messages) */
  conversationHistory?: any[];
}

/**
 * Interface for task execution services
 *
 * Implementations handle the actual execution of tasks,
 * including Claude API calls, timeout management, and cancellation
 */
export interface TaskExecutor {
  /**
   * Execute a task request
   * @param task - The task to execute
   * @param taskId - Optional ID for tracking and cancellation
   * @param retryMetadata - Metadata from previous retry attempts
   * @returns Execution result with status, output, and logs
   */
  execute(
    task: TaskRequest,
    taskId?: string,
    retryMetadata?: TaskResponse["retryMetadata"],
  ): Promise<ClaudeExecutionResult>;

  /**
   * Cancel a running task
   * @param taskId - ID of the task to cancel
   * @throws Error if task not found or already completed
   */
  cancel(taskId: string): Promise<void>;
}
