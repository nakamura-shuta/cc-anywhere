import type { TaskRequest, TaskResponse, TaskStatus, RetryAttempt } from "../claude/types";

// Queue task with metadata
export interface QueuedTask {
  id: string;
  request: TaskRequest;
  priority: number;
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: TaskStatus;
  result?: TaskResponse;
  error?: Error;
  retryMetadata?: {
    currentAttempt: number;
    maxRetries: number;
    retryHistory: RetryAttempt[];
    nextRetryAt?: Date;
  };
}

// Queue options
export interface QueueOptions {
  concurrency?: number;
  timeout?: number;
  interval?: number;
  intervalCap?: number;
  autoStart?: boolean;
}

// Queue statistics
export interface QueueStats {
  size: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  isPaused: boolean;
}

// Task queue interface
export interface TaskQueue {
  // Add task to queue
  add(task: TaskRequest, priority?: number): string;

  // Get task by ID
  get(taskId: string): QueuedTask | undefined;

  // Get all tasks
  getAll(): QueuedTask[];

  // Get queue statistics
  getStats(): QueueStats;

  // Queue control
  start(): void;
  pause(): void;
  clear(): void;

  // Cancel specific task
  cancelTask(taskId: string): Promise<boolean>;

  // Event listeners
  onTaskComplete(callback: (task: QueuedTask) => void): void;
  onTaskError(callback: (task: QueuedTask, error: Error) => void): void;
}
