import type { RetryConfig, TaskStatus } from "../claude/types";

export interface BatchRepository {
  name: string;
  path: string;
  timeout?: number;
  retryOptions?: Pick<RetryConfig, "maxRetries" | "initialDelay" | "maxDelay">;
}

export interface CreateBatchTaskParams {
  instruction: string;
  repositories: BatchRepository[];
  options?: {
    timeout?: number;
    allowedTools?: string[];
    retry?: Pick<RetryConfig, "maxRetries" | "initialDelay" | "maxDelay">;
  };
}

export interface BatchTaskResponse {
  groupId: string;
  tasks: Array<{
    taskId: string;
    repository: string;
    status: TaskStatus;
  }>;
}

export interface BatchTaskStatus {
  groupId: string;
  summary: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  tasks: Array<{
    taskId: string;
    repository: string;
    status: TaskStatus;
    duration?: number;
    result?: any;
    error?: any;
  }>;
}
