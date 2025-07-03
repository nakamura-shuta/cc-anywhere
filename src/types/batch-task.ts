export interface BatchRepository {
  name: string;
  path: string;
  timeout?: number;
  retryOptions?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

export interface CreateBatchTaskParams {
  instruction: string;
  repositories: BatchRepository[];
  options?: {
    timeout?: number;
    allowedTools?: string[];
    retry?: {
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
    };
  };
}

export interface BatchTaskResponse {
  groupId: string;
  tasks: Array<{
    taskId: string;
    repository: string;
    status: string;
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
    status: string;
    duration?: number;
    result?: any;
    error?: any;
  }>;
}