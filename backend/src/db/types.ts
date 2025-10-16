import type { TaskStatus } from "../claude/types";
import type { ExecutorType, ExecutorMetadata } from "../agents/types.js";

export interface TaskRecord {
  id: string;
  instruction: string;
  context?: any; // Parsed JSON
  options?: any; // Parsed JSON
  priority: number;
  status: TaskStatus;
  result?: any; // Parsed JSON
  error?: any; // Parsed JSON
  retryMetadata?: any; // Parsed JSON containing retry history
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  // Batch task support
  groupId?: string;
  repositoryName?: string;
  // Conversation history
  conversationHistory?: any; // Parsed JSON containing SDK messages
  // Task continuation
  continuedFrom?: string; // Parent task ID for continuation
  // Claude Code SDK session
  sdkSessionId?: string; // Claude Code SDK session ID for continue functionality
  // Executor information
  executor?: ExecutorType; // Which agent executor was used
  executorMetadata?: ExecutorMetadata; // Executor-specific metadata
  // Progress data
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
    todos?: Array<{
      content: string;
      status: "pending" | "in_progress" | "completed";
      priority: "high" | "medium" | "low";
      id: string;
    }>;
    // 詳細な実行履歴
    toolExecutions?: Array<{
      type: "start" | "end";
      tool: string;
      timestamp: string;
      args?: any;
      output?: any;
      error?: string;
      duration?: number;
      success?: boolean;
    }>;
    claudeResponses?: Array<{
      text: string;
      turnNumber: number;
      maxTurns?: number;
      timestamp: string;
    }>;
    logs?: string[];
  };
}

export interface TaskFilter {
  status?: TaskRecord["status"] | TaskRecord["status"][];
  priority?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
  groupId?: string;
  repositoryName?: string;
  executor?: ExecutorType; // Filter by executor type
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: "created_at" | "updated_at" | "priority";
  orderDirection?: "ASC" | "DESC";
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
}
