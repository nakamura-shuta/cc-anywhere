import fastify, { type FastifyServerOptions, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { errorHandlerPlugin } from "./plugins/error-handler";
// import { authPlugin } from "./plugins/auth";
import { registerStaticPlugin } from "./plugins/static";
import { healthRoutes } from "./routes/health";
import { echoRoutes } from "./routes/echo";
import { taskRoutes } from "./routes/tasks";
import queueRoutes from "./routes/queue";
import { historyRoutes } from "./routes/history";
import { workerRoutes } from "./routes/workers";
import { repositoryRoutes } from "./routes/repositories";
import { batchTaskRoutes } from "./routes/batch-tasks";
import { presetRoutes } from "./routes/presets";
import { scheduleRoutes } from "./routes/schedules";
import { sessionRoutes } from "./routes/sessions";
import { logger } from "../utils/logger";
import { config } from "../config";
import { TaskQueueImpl } from "../queue";
import { WorkerManager } from "../worker/worker-manager";
import { WebSocketServer } from "../websocket/websocket-server";
import { getSharedDbProvider, getSharedRepository } from "../db/shared-instance";
import { getTypedEventBus } from "../events";
import { SchedulerService } from "../services/scheduler-service";

export interface AppOptions extends FastifyServerOptions {
  workerMode?: "inline" | "standalone" | "managed";
}

export async function createApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const loggerOptions = config.isDevelopment
    ? {
        level: config.logging.level,
        transport: {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
            colorize: true,
          },
        },
      }
    : {
        level: config.logging.level,
      };

  const app = fastify({
    logger: opts.logger ?? loggerOptions,
    ...opts,
  });

  // Determine worker mode
  const workerMode = opts.workerMode ?? config.worker.mode;

  // Initialize based on worker mode
  logger.info("Initializing application", { workerMode });

  let taskQueue: TaskQueueImpl;
  let workerManager: WorkerManager | undefined;
  let wsServer: WebSocketServer | undefined;

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

      // Decorate app with worker manager
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

  app.decorate("queue", taskQueue);

  // Use shared database and repository instances
  const dbProvider = getSharedDbProvider();
  const repository = getSharedRepository();
  app.decorate("dbProvider", dbProvider);
  app.decorate("repository", repository);

  // Initialize scheduler service
  const schedulerService = new SchedulerService();
  app.decorate("schedulerService", schedulerService);

  // Set up scheduler execution handler
  schedulerService.setOnExecuteHandler(async (taskRequest, scheduleId) => {
    logger.info("Executing scheduled task", { scheduleId });
    const taskId = taskQueue.add(taskRequest, 0);
    return { taskId };
  });

  // Initialize WebSocket server
  if (config.websocket?.enabled !== false) {
    wsServer = new WebSocketServer({
      heartbeatInterval: config.websocket?.heartbeatInterval,
      heartbeatTimeout: config.websocket?.heartbeatTimeout,
      authTimeout: config.websocket?.authTimeout,
    });

    await wsServer.register(app);
    app.decorate("wsServer", wsServer);

    // Set up WebSocket integration with task queue
    taskQueue.onTaskComplete((task) => {
      logger.info("Broadcasting task completion via WebSocket", {
        taskId: task.id,
        status: task.status,
      });

      wsServer?.broadcastTaskUpdate({
        taskId: task.id,
        status: task.status,
        timestamp: new Date().toISOString(),
        metadata: {
          completedAt: task.completedAt,
          duration:
            task.completedAt && task.startedAt
              ? task.completedAt.getTime() - task.startedAt.getTime()
              : undefined,
          result: task.result?.result,
          workingDirectory: task.request.context?.workingDirectory,
        },
      });
    });

    taskQueue.onTaskError((task, error) => {
      wsServer?.broadcastTaskUpdate({
        taskId: task.id,
        status: task.status,
        timestamp: new Date().toISOString(),
        metadata: {
          error: {
            message: error.message,
            code: "EXECUTION_ERROR",
          },
          workingDirectory: task.request.context?.workingDirectory,
        },
      });
    });

    // Set WebSocket server for log streaming
    taskQueue.setWebSocketServer(wsServer);

    // Listen for task started events
    const eventBus = getTypedEventBus();
    void eventBus.on("task.started", (payload) => {
      const task = taskQueue.get(payload.taskId);
      if (task) {
        wsServer?.broadcastTaskUpdate({
          taskId: task.id,
          status: task.status,
          timestamp: new Date().toISOString(),
          metadata: {
            startedAt: task.startedAt,
            workingDirectory: task.request.context?.workingDirectory,
          },
        });
      }
    });

    logger.info("WebSocket server initialized");
  }

  // Register core plugins
  await app.register(helmet, {
    contentSecurityPolicy: false, // We'll configure this later based on needs
  });

  await app.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await app.register(sensible);

  // Register static file serving for Web UI (before auth to bypass authentication)
  await app.register(registerStaticPlugin);

  // Register custom plugins
  await app.register(errorHandlerPlugin);
  // await app.register(authPlugin); // 一時的に無効化

  // Register routes
  await app.register(healthRoutes);
  await app.register(echoRoutes, { prefix: "/api" });
  await app.register(taskRoutes, { prefix: "/api" });
  await app.register(queueRoutes, { prefix: "/api" });
  await app.register(historyRoutes, { prefix: "/api" });
  await app.register(repositoryRoutes, { prefix: "/api" });
  await app.register(batchTaskRoutes, { prefix: "/api" });
  await app.register(presetRoutes, { prefix: "/api" });
  await app.register(scheduleRoutes);
  await app.register(sessionRoutes);

  // Register worker routes only in managed mode
  if (workerMode === "managed") {
    await app.register(workerRoutes, { prefix: "/api" });
  }

  // Graceful shutdown
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

  // Start the scheduler service
  schedulerService.start();
  logger.info("Scheduler service started");

  return app;
}
