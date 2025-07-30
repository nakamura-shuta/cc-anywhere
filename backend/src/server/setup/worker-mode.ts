import type { FastifyInstance } from "fastify";
import { TaskQueueImpl } from "../../queue";
import { WorkerManager } from "../../worker/worker-manager";
import { config } from "../../config";
import { logger } from "../../utils/logger";

export interface WorkerModeSetupResult {
  taskQueue: TaskQueueImpl;
  workerManager?: WorkerManager;
}

/**
 * Set up worker mode configuration for the application
 * @param app Fastify instance (for decoration in managed mode)
 * @param workerMode Worker mode to configure
 * @returns Task queue and optional worker manager
 */
export async function setupWorkerMode(
  app: FastifyInstance,
  workerMode: "inline" | "standalone" | "managed",
): Promise<WorkerModeSetupResult> {
  logger.info("Initializing application", { workerMode });

  // 実行モードをログに出力
  if (config.forceExecutionMode) {
    logger.info("Using forced execution mode", { mode: config.forceExecutionMode });
  }

  let taskQueue: TaskQueueImpl;
  let workerManager: WorkerManager | undefined;

  switch (workerMode) {
    case "standalone":
      // In standalone mode, the queue only accepts tasks but doesn't process them
      logger.info("Running in standalone mode - tasks will be queued for external workers");
      taskQueue = new TaskQueueImpl({
        concurrency: 0, // Don't process tasks in this process
        autoStart: false,
      });
      break;

    case "managed":
      // In managed mode, spawn and manage worker processes
      logger.info("Running in managed mode - spawning worker processes");
      taskQueue = new TaskQueueImpl({
        concurrency: 0, // Don't process tasks in this process
        autoStart: false,
      });

      // Create worker manager
      workerManager = new WorkerManager({
        concurrency: config.queue.concurrency,
        autoRestart: true,
        maxRestarts: 5,
      });

      // Start workers
      for (let i = 0; i < config.worker.count; i++) {
        await workerManager.startWorker(`worker-${i}`);
      }

      // Decorate app with worker manager (for worker routes)
      app.decorate("workerManager", workerManager);
      break;

    case "inline":
    default:
      // In inline mode, process tasks in the same process (default behavior)
      logger.info("Running in inline mode - processing tasks in main process");
      taskQueue = new TaskQueueImpl({
        concurrency: config.queue?.concurrency || 2,
        autoStart: true,
      });

      // Set up queue event handlers for inline mode
      taskQueue.onTaskComplete((task) => {
        logger.info("Queue task completed", {
          taskId: task.id,
          instruction: task.request.instruction,
          duration:
            task.completedAt && task.startedAt
              ? task.completedAt.getTime() - task.startedAt.getTime()
              : 0,
        });
      });

      taskQueue.onTaskError((task, error) => {
        logger.error("Queue task failed", {
          taskId: task.id,
          instruction: task.request.instruction,
          error: error.message,
        });
      });
      break;
  }

  return { taskQueue, workerManager };
}
