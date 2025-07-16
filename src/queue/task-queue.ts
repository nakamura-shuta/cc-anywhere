import PQueue from "p-queue";
import { v4 as uuidv4 } from "uuid";
import type { TaskRequest } from "../claude/types";
import { TaskStatus } from "../claude/types";
import type { QueuedTask, QueueOptions, QueueStats, TaskQueue } from "./types";
import { TaskExecutorImpl } from "../claude/executor";
import { logger } from "../utils/logger";
import { getSharedRepository } from "../db/shared-instance";
import type { TaskRepositoryAdapter } from "../repositories/task-repository-adapter";
import { RetryService } from "../services/retry-service";
import type { WebSocketServer } from "../websocket/websocket-server.js";
import { getTypedEventBus, type TypedEventBus } from "../events";

export { TaskQueue };

export class TaskQueueImpl implements TaskQueue {
  private queue: PQueue;
  private tasks: Map<string, QueuedTask> = new Map();
  private executor: TaskExecutorImpl;
  private completedCount = 0;
  private failedCount = 0;
  private repository: TaskRepositoryAdapter;
  private wsServer?: WebSocketServer;
  private eventBus: TypedEventBus;

  // Legacy event handlers (deprecated - will be removed)
  private onCompleteHandlers: Array<(task: QueuedTask) => void> = [];
  private onErrorHandlers: Array<(task: QueuedTask, error: Error) => void> = [];

  constructor(options: QueueOptions = {}) {
    // Build queue options dynamically to avoid read-only property issues
    const queueOptions: ConstructorParameters<typeof PQueue>[0] = {
      concurrency: options.concurrency || 1,
      autoStart: options.autoStart !== false,
    };

    // Only add optional properties if they are defined
    if (options.timeout !== undefined) {
      Object.assign(queueOptions, { timeout: options.timeout });
    }
    if (options.interval !== undefined) {
      Object.assign(queueOptions, { interval: options.interval });
    }
    if (options.intervalCap !== undefined) {
      Object.assign(queueOptions, { intervalCap: options.intervalCap });
    }

    this.queue = new PQueue(queueOptions);

    this.executor = new TaskExecutorImpl();
    // Use shared repository instance
    this.repository = getSharedRepository();
    this.eventBus = getTypedEventBus(); // Initialize event bus

    // Restore pending tasks from database
    this.restorePendingTasks();

    logger.info("Task queue initialized", {
      concurrency: this.queue.concurrency,
      autoStart: options.autoStart !== false,
    });
  }

  add(
    request: TaskRequest,
    priority = 0,
    metadata?: { groupId?: string; repositoryName?: string },
  ): string {
    const taskId = uuidv4();

    // Initialize retry metadata if retry is configured
    const retryConfig = RetryService.getRetryOptions(request.options);
    const retryMetadata = retryConfig.maxRetries
      ? RetryService.createInitialRetryMetadata(retryConfig)
      : undefined;
    const queuedTask: QueuedTask = {
      id: taskId,
      request,
      priority,
      addedAt: new Date(),
      status: TaskStatus.PENDING,
      retryMetadata,
    };

    this.tasks.set(taskId, queuedTask);

    // Persist task to database
    try {
      this.repository.create({
        id: taskId,
        instruction: request.instruction,
        context: request.context,
        options: request.options,
        priority,
        status: TaskStatus.PENDING,
        retryMetadata,
        groupId: metadata?.groupId,
        repositoryName: metadata?.repositoryName,
      });
    } catch (error) {
      logger.error("Failed to persist task", { taskId, error });
    }

    // Emit task created event
    void this.eventBus.emit("task.created", {
      taskId,
      request,
      priority,
      createdAt: queuedTask.addedAt,
    });

    // Add task to queue with priority
    void this.queue.add(
      async () => {
        await this.executeTask(queuedTask);
      },
      { priority },
    );

    logger.info("Task added to queue", {
      taskId,
      instruction: request.instruction,
      priority,
      queueSize: this.queue.size,
    });

    return taskId;
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    try {
      // Update task status
      task.status = TaskStatus.RUNNING;
      task.startedAt = new Date();

      // Update status in database
      try {
        this.repository.updateStatus(task.id, TaskStatus.RUNNING);
      } catch (error) {
        logger.error("Failed to update task status in database", { taskId: task.id, error });
      }

      logger.info("Task execution started", {
        taskId: task.id,
        instruction: task.request.instruction,
        currentAttempt: task.retryMetadata?.currentAttempt ?? 0,
      });

      // Emit task started event
      void this.eventBus.emit("task.started", {
        taskId: task.id,
        startedAt: task.startedAt,
      });

      // Set up progress handler for WebSocket log streaming
      const requestWithProgress = {
        ...task.request,
        options: {
          ...task.request.options,
          onProgress: this.wsServer
            ? async (progress: { type: string; message: string; data?: any }) => {
                const timestamp = new Date().toISOString();

                switch (progress.type) {
                  case "log":
                    logger.debug("Sending progress log via WebSocket", {
                      taskId: task.id,
                      message: progress.message,
                    });
                    this.wsServer?.broadcastTaskLog({
                      taskId: task.id,
                      log: progress.message,
                      timestamp,
                      level: "info",
                    });
                    break;

                  case "tool_usage":
                    if (progress.data) {
                      this.wsServer?.broadcastToolUsage({
                        taskId: task.id,
                        tool: {
                          ...progress.data,
                          timestamp: progress.data.timestamp?.toISOString() || timestamp,
                        },
                      });
                    }
                    break;

                  case "progress":
                    if (progress.data) {
                      this.wsServer?.broadcastTaskProgress({
                        taskId: task.id,
                        progress: {
                          ...progress.data,
                          timestamp: progress.data.timestamp?.toISOString() || timestamp,
                        },
                      });
                    }
                    break;

                  case "summary":
                    if (progress.data) {
                      this.wsServer?.broadcastTaskSummary({
                        taskId: task.id,
                        summary: progress.data,
                      });
                    }
                    break;
                  case "todo_update":
                    if (progress.data && progress.data.todos) {
                      // 実行中のタスクのTODOを一時的に保存
                      task.todos = progress.data.todos;

                      // Broadcast todo update via WebSocket
                      if (this.wsServer) {
                        this.wsServer.broadcastTodoUpdate({
                          taskId: task.id,
                          todos: progress.data.todos,
                        });
                      } else {
                        logger.warn("WebSocket server not available for todo update");
                      }
                    } else {
                      logger.warn("todo_update progress missing todos data", {
                        taskId: task.id,
                        data: progress.data,
                      });
                    }
                    break;
                    
                  case "tool:start":
                    if (progress.data) {
                      this.wsServer?.broadcastToolStart({
                        taskId: task.id,
                        toolId: progress.data.toolId || `${progress.data.tool}-${Date.now()}`,
                        tool: progress.data.tool,
                        input: progress.data.input,
                        timestamp,
                      });
                    }
                    break;

                  case "tool:end":
                    if (progress.data) {
                      this.wsServer?.broadcastToolEnd({
                        taskId: task.id,
                        toolId: progress.data.toolId,
                        tool: progress.data.tool,
                        output: progress.data.output,
                        error: progress.data.error,
                        duration: progress.data.duration,
                        success: progress.data.success,
                        timestamp,
                      });
                    }
                    break;

                  case "claude:response":
                    if (progress.data) {
                      this.wsServer?.broadcastClaudeResponse({
                        taskId: task.id,
                        text: progress.message,
                        turnNumber: progress.data.turnNumber || 1,
                        timestamp,
                      });
                    }
                    break;

                  case "statistics":
                    if (progress.data) {
                      this.wsServer?.broadcastTaskStatistics({
                        taskId: task.id,
                        statistics: progress.data,
                      });
                    }
                    break;
                    
                  default:
                    // Log any other type as a regular log message
                    if (progress.message) {
                      logger.info("Task progress", {
                        taskId: task.id,
                        type: progress.type,
                        message: progress.message,
                      });
                      // Also broadcast as a log message
                      this.wsServer?.broadcastTaskLog({
                        taskId: task.id,
                        log: progress.message,
                        timestamp,
                      });
                    }
                }
              }
            : undefined,
        },
      };

      // Execute the task with taskId for cancellation support
      const result = await this.executor.execute(requestWithProgress, task.id, task.retryMetadata);

      // Update task with result
      task.completedAt = new Date();

      if (result.success) {
        task.status = TaskStatus.COMPLETED;
        task.result = {
          taskId: task.id,
          status: TaskStatus.COMPLETED,
          instruction: task.request.instruction,
          createdAt: task.addedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          result: result.output,
          logs: result.logs,
          todos: result.todos || task.todos, // Use saved todos if result doesn't have them
        };

        this.completedCount++;

        // Update result and status in database
        try {
          this.repository.updateResult(task.id, task.result);
          this.repository.updateStatus(task.id, TaskStatus.COMPLETED);
          logger.info("Task result updated in database", { taskId: task.id, status: task.status });
        } catch (error) {
          logger.error("Failed to update task result in database", { taskId: task.id, error });
        }

        // Emit task completed event
        void this.eventBus.emit("task.completed", {
          taskId: task.id,
          result: task.result,
          duration: result.duration || 0,
          completedAt: task.completedAt,
        });

        // Notify complete handlers (backward compatibility)
        this.onCompleteHandlers.forEach((handler) => {
          try {
            handler(task);
          } catch (error) {
            logger.error("Error in complete handler", { error });
          }
        });

        logger.info("Task completed successfully", {
          taskId: task.id,
          duration: result.duration,
        });
      } else {
        const error = result.error || new Error("Unknown error");
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: "EXECUTION_ERROR",
        };

        // Check if task should be retried
        const retryConfig = RetryService.getRetryOptions(task.request.options);
        const shouldRetry = RetryService.shouldRetry(
          task.retryMetadata?.currentAttempt ?? 0,
          error,
          retryConfig,
        );

        if (shouldRetry) {
          // Update retry metadata
          const updatedRetryMetadata = RetryService.updateRetryMetadata(
            task.retryMetadata,
            errorInfo,
            task.startedAt,
            task.completedAt,
            retryConfig,
          );

          task.retryMetadata = updatedRetryMetadata;

          // Calculate retry delay
          const delay = RetryService.calculateRetryDelay(
            updatedRetryMetadata.currentAttempt,
            retryConfig,
          );

          // Update retry metadata in database
          try {
            this.repository.updateRetryMetadata(task.id, updatedRetryMetadata);
            this.repository.resetTaskForRetry(task.id);
          } catch (dbError) {
            logger.error("Failed to update retry metadata in database", {
              taskId: task.id,
              error: dbError,
            });
          }

          // Log retry attempt
          RetryService.logRetryAttempt(
            task.id,
            updatedRetryMetadata.currentAttempt,
            updatedRetryMetadata.maxRetries,
            delay,
            errorInfo,
          );

          // Emit retry scheduled event
          void this.eventBus.emit("task.retry.scheduled", {
            taskId: task.id,
            attemptNumber: updatedRetryMetadata.currentAttempt,
            scheduledFor: new Date(Date.now() + delay),
            previousError: errorInfo.message,
          });

          // Schedule retry
          setTimeout(() => {
            // Re-add task to queue for retry
            void this.queue.add(
              async () => {
                // Reset task state for retry
                task.status = TaskStatus.PENDING;
                task.startedAt = undefined;
                task.completedAt = undefined;
                task.error = undefined;
                task.result = undefined;
                await this.executeTask(task);
              },
              { priority: task.priority },
            );
          }, delay);

          // Don't mark as failed yet - it's being retried
          return;
        }

        // Max retries reached or error not retryable
        task.status = TaskStatus.FAILED;
        task.error = error;
        task.result = {
          taskId: task.id,
          status: TaskStatus.FAILED,
          instruction: task.request.instruction,
          createdAt: task.addedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          error: errorInfo,
          logs: result.logs,
          retryMetadata: task.retryMetadata,
        };

        this.failedCount++;

        // Update status in database
        try {
          this.repository.updateStatus(task.id, TaskStatus.FAILED, error);
        } catch (dbError) {
          logger.error("Failed to update task status in database", {
            taskId: task.id,
            error: dbError,
          });
        }

        // Emit task failed event
        void this.eventBus.emit("task.failed", {
          taskId: task.id,
          error: errorInfo,
          failedAt: task.completedAt,
          willRetry: false,
          retryCount: task.retryMetadata?.currentAttempt,
        });

        // Notify error handlers (backward compatibility)
        this.onErrorHandlers.forEach((handler) => {
          try {
            handler(task, error);
          } catch (handlerError) {
            logger.error("Error in error handler", { error: handlerError });
          }
        });

        logger.error("Task failed", {
          taskId: task.id,
          error,
          retryAttempts: task.retryMetadata?.currentAttempt ?? 0,
          maxRetries: task.retryMetadata?.maxRetries ?? 0,
        });
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if task was cancelled
      if (errorMessage === "Task was cancelled") {
        task.status = TaskStatus.CANCELLED;
        task.completedAt = new Date();

        // Update status in database
        try {
          this.repository.updateStatus(task.id, TaskStatus.CANCELLED);
        } catch (dbError) {
          logger.error("Failed to update task status in database", {
            taskId: task.id,
            error: dbError,
          });
        }

        // Emit task cancelled event
        void this.eventBus.emit("task.cancelled", {
          taskId: task.id,
          reason: "User requested cancellation",
          cancelledAt: task.completedAt,
        });

        logger.info("Task cancelled during execution", { taskId: task.id });

        // Don't count cancellations as failures
        return;
      }

      task.status = TaskStatus.FAILED;
      task.error = error instanceof Error ? error : new Error(String(error));
      task.completedAt = new Date();

      this.failedCount++;

      // Update status in database
      try {
        this.repository.updateStatus(task.id, TaskStatus.FAILED, task.error);
      } catch (dbError) {
        logger.error("Failed to update task status in database", {
          taskId: task.id,
          error: dbError,
        });
      }

      logger.error("Unexpected error during task execution", {
        taskId: task.id,
        error,
      });

      // Emit task failed event
      void this.eventBus.emit("task.failed", {
        taskId: task.id,
        error: {
          message: task.error.message,
          code: "UNEXPECTED_ERROR",
          stack: task.error.stack,
        },
        failedAt: task.completedAt,
        willRetry: false,
      });

      // Notify error handlers (backward compatibility)
      this.onErrorHandlers.forEach((handler) => {
        try {
          handler(task, task.error!);
        } catch (err) {
          logger.error("Error in error handler", { error: err });
        }
      });
    }
  }

  get(taskId: string): QueuedTask | undefined {
    return this.tasks.get(taskId);
  }

  getAll(): QueuedTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => {
      // Sort by status (running first, then pending, then completed/failed)
      const statusOrder: Record<TaskStatus, number> = {
        [TaskStatus.RUNNING]: 0,
        [TaskStatus.PENDING]: 1,
        [TaskStatus.COMPLETED]: 2,
        [TaskStatus.FAILED]: 3,
        [TaskStatus.CANCELLED]: 4,
        [TaskStatus.SCHEDULED]: 5,
        [TaskStatus.DELAYED]: 6,
      };

      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // Then by priority (higher first)
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Finally by added time (older first)
      return a.addedAt.getTime() - b.addedAt.getTime();
    });
  }

  getStats(): QueueStats {
    const tasks = Array.from(this.tasks.values());
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING).length;
    const running = tasks.filter((t) => t.status === TaskStatus.RUNNING).length;

    return {
      size: this.queue.size,
      pending,
      running,
      completed: this.completedCount,
      failed: this.failedCount,
      isPaused: this.queue.isPaused,
    };
  }

  start(): void {
    this.queue.start();
    logger.info("Task queue started");
  }

  pause(): void {
    this.queue.pause();
    logger.info("Task queue paused");
  }

  clear(): void {
    this.queue.clear();

    // Cancel all pending tasks and clear the map
    this.tasks.forEach((task) => {
      if (task.status === TaskStatus.PENDING) {
        task.status = TaskStatus.CANCELLED;
        task.completedAt = new Date();
      }
    });

    // Clear all tasks from memory
    this.tasks.clear();

    // Reset counters
    this.completedCount = 0;
    this.failedCount = 0;

    logger.info("Task queue cleared");
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn("Task not found for cancellation", { taskId });
      return false;
    }

    // Can only cancel pending or running tasks
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RUNNING) {
      logger.warn("Task cannot be cancelled in current state", {
        taskId,
        status: task.status,
      });
      return false;
    }

    // If task is running, cancel it through the executor
    if (task.status === TaskStatus.RUNNING) {
      await this.executor.cancel(taskId);
    }

    // Update task status
    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();

    // Update status in database
    try {
      this.repository.updateStatus(task.id, TaskStatus.CANCELLED);
    } catch (error) {
      logger.error("Failed to update task status in database", { taskId, error });
    }

    // Emit task cancelled event
    void this.eventBus.emit("task.cancelled", {
      taskId: task.id,
      reason: "Cancelled via API",
      cancelledAt: task.completedAt,
    });

    logger.info("Task cancelled", { taskId });
    return true;
  }

  onTaskComplete(callback: (task: QueuedTask) => void): void {
    this.onCompleteHandlers.push(callback);
  }

  onTaskError(callback: (task: QueuedTask, error: Error) => void): void {
    this.onErrorHandlers.push(callback);
  }

  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
  }

  // Additional utility methods

  async waitForIdle(): Promise<void> {
    await this.queue.onIdle();
  }

  get concurrency(): number {
    return this.queue.concurrency;
  }

  set concurrency(value: number) {
    this.queue.concurrency = value;
    logger.info("Queue concurrency updated", { concurrency: value });
  }

  private restorePendingTasks(): void {
    try {
      const pendingTasks = this.repository.getPendingTasks();

      if (pendingTasks.length > 0) {
        logger.info("Restoring pending tasks from database", { count: pendingTasks.length });

        pendingTasks.forEach((task: QueuedTask) => {
          // Reset running tasks to pending
          if (task.status === TaskStatus.RUNNING) {
            task.status = TaskStatus.PENDING;
            task.startedAt = undefined;
          }

          this.tasks.set(task.id, task);

          // Re-add to queue
          void this.queue.add(
            async () => {
              await this.executeTask(task);
            },
            { priority: task.priority },
          );
        });
      }
    } catch (error) {
      logger.error("Failed to restore pending tasks", { error });
    }
  }
}
