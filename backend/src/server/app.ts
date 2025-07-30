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

  // 6. Register middleware (including authentication)
  await registerMiddleware(app);

  // 6.5. Apply QR auth globally to override plugin encapsulation
  if (config.qrAuth?.enabled && config.qrAuth?.token) {
    const { extractToken, isPublicPath } = await import("./middleware/qr-auth");

    app.addHook("onRequest", async (request, reply) => {
      // Skip public paths
      if (isPublicPath(request.url)) return;

      // Skip static files and WebSocket
      if (
        request.url.startsWith("/web/") ||
        request.url === "/" ||
        request.url.includes(".") ||
        request.headers.upgrade === "websocket"
      ) {
        return;
      }

      // Extract and validate token
      const token = extractToken(request);
      if (token !== config.qrAuth.token) {
        logger.warn("Unauthorized access attempt", {
          path: request.url,
          method: request.method,
          ip: request.ip,
          hasToken: !!token,
        });

        return reply.status(401).send({
          error: {
            message: "Unauthorized: Invalid or missing authentication token",
            statusCode: 401,
            code: "UNAUTHORIZED",
          },
        });
      }
    });
  }

  // 7. Register routes after middleware
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
