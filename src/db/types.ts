import type { TaskStatus } from "../claude/types";

export interface TaskRecord {
  id: string;
  instruction: string;
  context: string | null; // JSON string
  options: string | null; // JSON string
  priority: number;
  status: TaskStatus;
  result: string | null; // JSON string
  error: string | null; // JSON string
  retry_metadata: string | null; // JSON string containing retry history
  current_attempt: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  // Batch task support
  group_id: string | null;
  repository_name: string | null;
}

export interface TaskFilter {
  status?: TaskRecord["status"] | TaskRecord["status"][];
  priority?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
  orderBy?: "created_at" | "updated_at" | "priority";
  orderDirection?: "ASC" | "DESC";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
}
