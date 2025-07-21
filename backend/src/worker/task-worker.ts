import { TaskQueueImpl } from "../queue/task-queue";
import { logger } from "../utils/logger";
import { config } from "../config";
import type { QueuedTask } from "../queue/types";
import { TaskStatus } from "../claude/types";
import { RetryWorker } from "./retry-worker";

export interface WorkerOptions {
  concurrency?: number;
  pollInterval?: number;
  gracefulShutdownTimeout?: number;
}

export class TaskWorker {
  private queue: TaskQueueImpl;
  private retryWorker: RetryWorker;
  private isRunning = false;
  private isShuttingDown = false;
  private pollTimer?: NodeJS.Timeout;
  private readonly pollInterval: number;
  private readonly gracefulShutdownTimeout: number;
  private shutdownPromise?: Promise<void>;

  constructor(options: WorkerOptions = {}) {
    this.pollInterval = options.pollInterval ?? 5000; // Poll every 5 seconds by default
    this.gracefulShutdownTimeout = options.gracefulShutdownTimeout ?? 30000; // 30 seconds

    // Initialize queue with worker-specific settings
    this.queue = new TaskQueueImpl({
      concurrency: options.concurrency ?? config.queue.concurrency,
      autoStart: false, // Don't auto-start, we'll control it
    });

    // Initialize retry worker
    this.retryWorker = new RetryWorker(this.queue, {
      pollInterval: 10000, // Check for retries every 10 seconds
      batchSize: 10,
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Set up graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  private setupEventHandlers(): void {
    this.queue.onTaskComplete((task: QueuedTask) => {
      logger.info("[Worker] Task completed", {
        taskId: task.id,
        instruction: task.request.instruction,
        duration: this.calculateDuration(task),
      });
    });

    this.queue.onTaskError((task: QueuedTask, error: Error) => {
      logger.error("[Worker] Task failed", {
        taskId: task.id,
        instruction: task.request.instruction,
        error: error.message,
        stack: error.stack,
      });
    });
  }

  private setupShutdownHandlers(): void {
    // Only setup handlers if we're not in test environment
    if (process.env.NODE_ENV === "test") {
      return;
    }

    // Handle termination signals
    const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGUSR2"];

    signals.forEach((signal) => {
      // Check if we already have listeners to avoid duplicates
      if (process.listenerCount(signal) === 0) {
        process.on(signal, () => {
          logger.info(`[Worker] Received ${signal}, initiating graceful shutdown...`);

          // Prevent multiple shutdown attempts
          if (!this.shutdownPromise) {
            this.shutdownPromise = this.shutdown();
          }

          void this.shutdownPromise
            .then(() => {
              process.exit(0);
            })
            .catch((error) => {
              logger.error("[Worker] Error during shutdown", { error });
              process.exit(1);
            });
        });
      }
    });

    // Handle uncaught errors
    if (process.listenerCount("uncaughtException") === 0) {
      process.on("uncaughtException", (error) => {
        logger.error("[Worker] Uncaught exception", { error });
        void this.shutdown().then(() => process.exit(1));
      });
    }

    if (process.listenerCount("unhandledRejection") === 0) {
      process.on("unhandledRejection", (reason, promise) => {
        logger.error("[Worker] Unhandled rejection", { reason, promise });
        void this.shutdown().then(() => process.exit(1));
      });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("[Worker] Already running");
      return;
    }

    logger.info("[Worker] Starting task worker...", {
      concurrency: this.queue.concurrency,
      pollInterval: this.pollInterval,
    });

    this.isRunning = true;
    this.queue.start();
    this.retryWorker.start();

    // Start polling for queue stats
    this.startPolling();

    logger.info("[Worker] Task worker started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("[Worker] Not running");
      return;
    }

    logger.info("[Worker] Stopping task worker...");

    this.isRunning = false;
    this.stopPolling();
    this.queue.pause();
    this.retryWorker.stop();

    logger.info("[Worker] Task worker stopped");
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("[Worker] Already shutting down");
      return;
    }

    this.isShuttingDown = true;
    logger.info("[Worker] Initiating graceful shutdown...");

    // Stop accepting new tasks
    this.queue.pause();
    this.retryWorker.stop();
    this.stopPolling();

    // Get current stats
    const stats = this.queue.getStats();
    logger.info("[Worker] Current queue stats", stats);

    if (stats.running > 0 || stats.pending > 0) {
      logger.info("[Worker] Waiting for tasks to complete...", {
        running: stats.running,
        pending: stats.pending,
        timeout: this.gracefulShutdownTimeout,
      });

      try {
        // Wait for all tasks to complete with timeout
        await this.waitForTasksWithTimeout(this.gracefulShutdownTimeout);
        logger.info("[Worker] All tasks completed");
      } catch (error) {
        logger.error("[Worker] Timeout waiting for tasks to complete", { error });

        // Cancel remaining tasks
        const remainingTasks = this.queue
          .getAll()
          .filter(
            (task) => task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING,
          );

        logger.warn("[Worker] Cancelling remaining tasks", {
          count: remainingTasks.length,
        });

        // Clear the queue
        this.queue.clear();
      }
    }

    this.isRunning = false;
    logger.info("[Worker] Graceful shutdown completed");
  }

  private async waitForTasksWithTimeout(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${timeout}ms`));
      }, timeout);

      this.queue
        .waitForIdle()
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch(reject);
    });
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      if (this.isRunning && !this.isShuttingDown) {
        const stats = this.queue.getStats();
        logger.debug("[Worker] Queue stats", stats);

        // Log warning if queue is getting too large
        if (stats.pending > 100) {
          logger.warn("[Worker] Large number of pending tasks", {
            pending: stats.pending,
          });
        }
      }
    }, this.pollInterval);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private calculateDuration(task: QueuedTask): number {
    if (task.completedAt && task.startedAt) {
      return task.completedAt.getTime() - task.startedAt.getTime();
    }
    return 0;
  }

  // Utility methods for monitoring

  getStats() {
    return this.queue.getStats();
  }

  getTasks() {
    return this.queue.getAll();
  }

  isHealthy(): boolean {
    return this.isRunning && !this.isShuttingDown;
  }

  getHealth() {
    return {
      status: this.isHealthy() ? "healthy" : "unhealthy",
      isRunning: this.isRunning,
      isShuttingDown: this.isShuttingDown,
      stats: this.queue.getStats(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
