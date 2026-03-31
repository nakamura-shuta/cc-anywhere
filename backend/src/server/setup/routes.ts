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
import { sessionV2Routes } from "../routes/sessions-v2";
import { workspaceRoutes } from "../routes/workspaces";
import { UnifiedSessionService } from "../../session/unified-session-service.js";
import { WorkspaceService } from "../../services/workspace-service.js";
import { setSharedWorkspaceService } from "../../services/workspace-resolver.js";
import { getSharedDbProvider } from "../../db/shared-instance.js";
import { logger } from "../../utils/logger.js";

// Application-shared UnifiedSessionService singleton
let sharedSessionService: UnifiedSessionService | null = null;

function getSharedSessionService(): UnifiedSessionService {
  if (!sharedSessionService) {
    const db = getSharedDbProvider().getDb();
    sharedSessionService = new UnifiedSessionService(db);
  }
  return sharedSessionService;
}

// TTL eviction interval (every 5 minutes)
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  if (sharedSessionService) {
    const evicted = sharedSessionService.runtime.evictIdle();
    if (evicted > 0) {
      logger.info(`Evicted ${evicted} idle V2 sessions`);
    }
  }
}, EVICTION_INTERVAL_MS);

export async function registerRoutes(
  app: FastifyInstance,
  workerMode: "inline" | "standalone" | "managed",
): Promise<void> {
  const sessionService = getSharedSessionService();

  await app.register(healthRoutes);
  await app.register(echoRoutes, { prefix: "/api" });
  await app.register(taskRoutes, { prefix: "/api" });
  await app.register(queueRoutes, { prefix: "/api" });
  await app.register(historyRoutes, { prefix: "/api" });
  await app.register(repositoryRoutes, { prefix: "/api" });
  await app.register(batchTaskRoutes, { prefix: "/api" });
  await app.register(presetRoutes, { prefix: "/api" });
  await app.register(scheduleRoutes);
  await app.register(sessionRoutes, { sessionService });
  await app.register(settingsRoutes);
  await app.register(repositoryExplorerRoutes, { prefix: "/api" });
  await app.register(taskGroupsRoute, { prefix: "/api/task-groups" });
  await app.register(executorRoutes, { prefix: "/api" });

  const db = getSharedDbProvider().getDb();
  const workspaceService = new WorkspaceService(db);
  setSharedWorkspaceService(workspaceService);
  await app.register(workspaceRoutes, { prefix: "/api", workspaceService });

  await app.register(chatRoutes, { prefix: "/api", sessionService });
  await app.register(compareRoutes, { prefix: "/api" });
  await app.register(sessionV2Routes, { chatSessionService: sessionService.runtime });

  if (workerMode === "managed") {
    await app.register(workerRoutes, { prefix: "/api" });
  }
}
