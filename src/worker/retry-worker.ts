import { TaskRepository } from "../db/task-repository";
import type { TaskQueueImpl } from "../queue/task-queue";
import { logger } from "../utils/logger";
import { TaskStatus } from "../claude/types";

export interface RetryWorkerOptions {
  pollInterval?: number; // How often to check for retryable tasks (default: 10 seconds)
  batchSize?: number; // How many tasks to process per poll (default: 10)
}

export class RetryWorker {
  private repository: TaskRepository;
  private taskQueue: TaskQueueImpl;
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private pollInterval: number;
  private batchSize: number;

  constructor(taskQueue: TaskQueueImpl, options: RetryWorkerOptions = {}) {
    this.repository = new TaskRepository();
    this.taskQueue = taskQueue;
    this.pollInterval = options.pollInterval ?? 10000; // 10 seconds default
    this.batchSize = options.batchSize ?? 10;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn("[RetryWorker] Already running");
      return;
    }

    logger.info("[RetryWorker] Starting retry worker", {
      pollInterval: this.pollInterval,
      batchSize: this.batchSize,
    });

    this.isRunning = true;
    this.scheduleNextPoll();
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn("[RetryWorker] Not running");
      return;
    }

    logger.info("[RetryWorker] Stopping retry worker");

    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(() => {
      void this.pollForRetryableTasks();
    }, this.pollInterval);
  }

  private async pollForRetryableTasks(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get tasks ready for retry
      const tasks = this.repository.getTasksReadyForRetry();

      if (tasks.length === 0) {
        this.scheduleNextPoll();
        return;
      }

      logger.info("[RetryWorker] Found tasks ready for retry", {
        count: tasks.length,
      });

      // Process tasks in batches
      const tasksToProcess = tasks.slice(0, this.batchSize);

      for (const taskRecord of tasksToProcess) {
        try {
          const queuedTask = this.repository.toQueuedTask(taskRecord);

          logger.info("[RetryWorker] Re-queueing task for retry", {
            taskId: queuedTask.id,
            currentAttempt: taskRecord.current_attempt,
            maxRetries: taskRecord.max_retries,
          });

          // Re-add task to queue
          this.taskQueue.add(queuedTask.request, queuedTask.priority);

          // Mark original task as being retried
          this.repository.updateStatus(taskRecord.id, TaskStatus.PENDING);
        } catch (error) {
          logger.error("[RetryWorker] Failed to re-queue task", {
            taskId: taskRecord.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error("[RetryWorker] Error polling for retryable tasks", { error });
    } finally {
      // Schedule next poll
      this.scheduleNextPoll();
    }
  }
}
