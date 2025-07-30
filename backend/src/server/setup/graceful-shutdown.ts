import type { FastifyInstance } from "fastify";
import type { TaskQueueImpl } from "../../queue";
import type { WorkerManager } from "../../worker/worker-manager";
import type { WebSocketServer } from "../../websocket/websocket-server";
import type { SchedulerService } from "../../services/scheduler-service";
import { logger } from "../../utils/logger";

interface ShutdownDependencies {
  app: FastifyInstance;
  taskQueue: TaskQueueImpl;
  workerManager?: WorkerManager;
  wsServer?: WebSocketServer;
  schedulerService: SchedulerService;
  workerMode: "inline" | "standalone" | "managed";
}

/**
 * Set up graceful shutdown handlers for the application
 * @param dependencies All dependencies that need to be properly shut down
 */
export function setupGracefulShutdown(dependencies: ShutdownDependencies): void {
  const { app, taskQueue, workerManager, wsServer, schedulerService, workerMode } = dependencies;

  const gracefulShutdown = async () => {
    logger.info("Received shutdown signal, closing server gracefully...");
    try {
      // Stop accepting new tasks
      taskQueue.pause();

      // If using managed workers, shut them down
      if (workerManager) {
        logger.info("Shutting down worker manager...");
        await workerManager.shutdown();
      }

      // If inline mode, wait for current tasks to complete
      if (workerMode === "inline") {
        const stats = taskQueue.getStats();
        if (stats.running > 0 || stats.pending > 0) {
          logger.info("Waiting for tasks to complete...", {
            running: stats.running,
            pending: stats.pending,
          });

          try {
            await Promise.race([
              taskQueue.waitForIdle(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000)),
            ]);
          } catch (error) {
            logger.warn("Timeout waiting for tasks, proceeding with shutdown");
          }
        }
      }

      // Stop scheduler service
      logger.info("Stopping scheduler service...");
      schedulerService.stop();

      // Close WebSocket server
      if (wsServer) {
        logger.info("Closing WebSocket server...");
        await wsServer.close();
      }

      await app.close();
      logger.info("Server closed successfully");
      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  };

  // Only setup signal handlers if not in test environment
  if (process.env.NODE_ENV !== "test") {
    process.on("SIGTERM", () => void gracefulShutdown());
    process.on("SIGINT", () => void gracefulShutdown());
  }
}
