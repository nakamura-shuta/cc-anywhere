import { fork, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { join } from "path";
import { logger } from "../utils/logger";
import type { WorkerOptions } from "./task-worker";

interface WorkerManagerOptions extends WorkerOptions {
  autoRestart?: boolean;
  maxRestarts?: number;
  restartDelay?: number;
}

interface WorkerProcess {
  process: ChildProcess;
  startTime: Date;
  restartCount: number;
}

export class WorkerManager extends EventEmitter {
  private workers: Map<string, WorkerProcess> = new Map();
  private isShuttingDown = false;
  private readonly options: WorkerManagerOptions;

  constructor(options: WorkerManagerOptions = {}) {
    super();
    this.options = {
      autoRestart: true,
      maxRestarts: 5,
      restartDelay: 5000,
      ...options,
    };
  }

  async startWorker(workerId: string = "default"): Promise<void> {
    if (this.workers.has(workerId)) {
      logger.warn("[WorkerManager] Worker already exists", { workerId });
      return;
    }

    logger.info("[WorkerManager] Starting worker", { workerId });

    try {
      const workerPath = join(__dirname, "index.js");

      const workerProcess = fork(workerPath, [], {
        env: {
          ...process.env,
          WORKER_ID: workerId,
          WORKER_CONCURRENCY: String(this.options.concurrency || 2),
        },
        silent: false, // Allow worker to use parent's stdout/stderr
      });

      const worker: WorkerProcess = {
        process: workerProcess,
        startTime: new Date(),
        restartCount: 0,
      };

      this.workers.set(workerId, worker);

      // Set up event handlers
      this.setupWorkerEventHandlers(workerId, workerProcess);

      this.emit("worker:started", { workerId });
      logger.info("[WorkerManager] Worker started successfully", {
        workerId,
        pid: workerProcess.pid,
      });
    } catch (error) {
      logger.error("[WorkerManager] Failed to start worker", { workerId, error });
      this.emit("worker:error", { workerId, error });
      throw error;
    }
  }

  private setupWorkerEventHandlers(workerId: string, workerProcess: ChildProcess): void {
    workerProcess.on("exit", (code, signal) => {
      logger.info("[WorkerManager] Worker exited", { workerId, code, signal });

      const worker = this.workers.get(workerId);
      if (!worker) return;

      this.workers.delete(workerId);
      this.emit("worker:exit", { workerId, code, signal });

      // Auto-restart if enabled and not shutting down
      if (this.options.autoRestart && !this.isShuttingDown) {
        if (worker.restartCount < (this.options.maxRestarts || 5)) {
          logger.info("[WorkerManager] Attempting to restart worker", {
            workerId,
            restartCount: worker.restartCount + 1,
            maxRestarts: this.options.maxRestarts,
          });

          setTimeout(() => {
            void this.restartWorker(workerId, worker.restartCount + 1);
          }, this.options.restartDelay || 5000);
        } else {
          logger.error("[WorkerManager] Max restart attempts reached", {
            workerId,
            maxRestarts: this.options.maxRestarts,
          });
          this.emit("worker:max_restarts", { workerId });
        }
      }
    });

    workerProcess.on("error", (error) => {
      logger.error("[WorkerManager] Worker error", { workerId, error });
      this.emit("worker:error", { workerId, error });
    });

    // Handle messages from worker
    workerProcess.on("message", (message) => {
      this.emit("worker:message", { workerId, message });
    });
  }

  private async restartWorker(workerId: string, restartCount: number): Promise<void> {
    try {
      await this.startWorker(workerId);

      const worker = this.workers.get(workerId);
      if (worker) {
        worker.restartCount = restartCount;
      }

      this.emit("worker:restarted", { workerId, restartCount });
    } catch (error) {
      logger.error("[WorkerManager] Failed to restart worker", { workerId, error });
    }
  }

  async stopWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      logger.warn("[WorkerManager] Worker not found", { workerId });
      return;
    }

    logger.info("[WorkerManager] Stopping worker", { workerId, pid: worker.process.pid });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn("[WorkerManager] Worker did not exit gracefully, killing process", {
          workerId,
          pid: worker.process.pid,
        });
        worker.process.kill("SIGKILL");
        resolve();
      }, 30000); // 30 second timeout

      worker.process.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      // Send graceful shutdown signal
      worker.process.kill("SIGTERM");
    });
  }

  async stopAllWorkers(): Promise<void> {
    logger.info("[WorkerManager] Stopping all workers", {
      count: this.workers.size,
    });

    const stopPromises = Array.from(this.workers.keys()).map((workerId) =>
      this.stopWorker(workerId),
    );

    await Promise.all(stopPromises);
    logger.info("[WorkerManager] All workers stopped");
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("[WorkerManager] Already shutting down");
      return;
    }

    this.isShuttingDown = true;
    logger.info("[WorkerManager] Initiating shutdown...");

    await this.stopAllWorkers();

    this.removeAllListeners();
    logger.info("[WorkerManager] Shutdown completed");
  }

  getWorkerStatus(workerId: string) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return null;
    }

    return {
      workerId,
      pid: worker.process.pid,
      startTime: worker.startTime,
      uptime: Date.now() - worker.startTime.getTime(),
      restartCount: worker.restartCount,
      connected: worker.process.connected,
    };
  }

  getAllWorkerStatuses() {
    return Array.from(this.workers.keys())
      .map((workerId) => this.getWorkerStatus(workerId))
      .filter(Boolean);
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  isHealthy(): boolean {
    return !this.isShuttingDown && this.workers.size > 0;
  }
}
