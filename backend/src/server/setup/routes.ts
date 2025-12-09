import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../routes/health";
import { echoRoutes } from "../routes/echo";
import { taskRoutes } from "../routes/tasks";
import queueRoutes from "../routes/queue";
import { historyRoutes } from "../routes/history";
import { workerRoutes } from "../routes/workers";
import { repositoryRoutes } from "../routes/repositories";
import { batchTaskRoutes } from "../routes/batch-tasks";
import { presetRoutes } from "../routes/presets";
import { scheduleRoutes } from "../routes/schedules";
import { sessionRoutes } from "../routes/sessions";
import { settingsRoutes } from "../routes/settings";
import { repositoryExplorerRoutes } from "../routes/repository-explorer";
import taskGroupsRoute from "../routes/task-groups";
import { executorRoutes } from "../routes/executors";
import chatRoutes from "../routes/chat";
import { compareRoutes } from "../routes/compare";

/**
 * Register all API routes for the application
 * @param app Fastify instance
 * @param workerMode Worker mode to determine which routes to register
 */
export async function registerRoutes(
  app: FastifyInstance,
  workerMode: "inline" | "standalone" | "managed",
): Promise<void> {
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
  await app.register(settingsRoutes);
  await app.register(repositoryExplorerRoutes, { prefix: "/api" });
  await app.register(taskGroupsRoute, { prefix: "/api/task-groups" });
  await app.register(executorRoutes, { prefix: "/api" });
  await app.register(chatRoutes, { prefix: "/api" });
  await app.register(compareRoutes, { prefix: "/api" });

  // Register worker routes only in managed mode
  if (workerMode === "managed") {
    await app.register(workerRoutes, { prefix: "/api" });
  }
}
