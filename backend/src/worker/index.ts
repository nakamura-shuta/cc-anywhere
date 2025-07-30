import { TaskWorker } from "./task-worker";
import { logger } from "../utils/logger";
import { config } from "../config";

async function startWorker() {
  logger.info("[Worker] Initializing background worker...", {
    environment: config.env,
    concurrency: config.queue.concurrency,
  });

  const worker = new TaskWorker({
    concurrency: config.queue.concurrency,
    pollInterval: 5000, // 5 seconds
    gracefulShutdownTimeout: 60000, // 60 seconds
  });

  try {
    await worker.start();

    // Log health status periodically
    setInterval(() => {
      const health = worker.getHealth();
      logger.info("[Worker] Health check", health);
    }, 60000); // Every minute
  } catch (error) {
    logger.error("[Worker] Failed to start worker", { error });
    process.exit(1);
  }
}

// Start the worker
void startWorker();
