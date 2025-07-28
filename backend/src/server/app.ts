import fastify, { type FastifyServerOptions, type FastifyInstance } from "fastify";
import { logger } from "../utils/logger";
import { config } from "../config";
import {
  setupWorkerMode,
  configureWebSocket,
  registerMiddleware,
  registerRoutes,
  setupGracefulShutdown,
  decorateApp,
  setupScheduler,
  initializeServices,
} from "./setup";

export interface AppOptions extends FastifyServerOptions {
  workerMode?: "inline" | "standalone" | "managed";
}

/**
 * Create and configure Fastify application instance
 * @param opts Application options
 * @returns Configured Fastify instance
 */
export async function createApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  // Create Fastify instance with logger configuration
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

  // 1. Set up worker mode and task queue
  const { taskQueue, workerManager } = await setupWorkerMode(app, workerMode);

  // 2. Initialize shared services
  const services = initializeServices();

  // 3. Decorate app with services
  decorateApp(app, { taskQueue, workerManager, ...services });

  // 4. Set up scheduler with task queue integration
  setupScheduler(services.schedulerService, taskQueue);

  // 5. Configure WebSocket server
  const wsServer = await configureWebSocket(app, taskQueue);

  // 6. Register middleware
  await registerMiddleware(app);

  // 7. Register routes
  await registerRoutes(app, workerMode);

  // 8. Set up graceful shutdown
  setupGracefulShutdown({
    app,
    taskQueue,
    workerManager,
    wsServer,
    schedulerService: services.schedulerService,
    workerMode,
  });

  // 9. Start scheduler service
  services.schedulerService.start();
  logger.info("Scheduler service started");

  return app;
}
