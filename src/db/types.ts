import type { TaskStatus } from "../claude/types";

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
}

export interface TaskFilter {
  status?: TaskRecord["status"] | TaskRecord["status"][];
  priority?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
  groupId?: string;
  repositoryName?: string;
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
