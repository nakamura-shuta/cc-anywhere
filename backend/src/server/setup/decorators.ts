import type { FastifyInstance } from "fastify";
import type { TaskQueueImpl } from "../../queue";
import type { WorkerManager } from "../../worker/worker-manager";
import type { WebSocketServer } from "../../websocket/websocket-server";
import type { DatabaseProvider } from "../../db/database-provider";
import type { TaskRepositoryAdapter } from "../../repositories/task-repository-adapter";
import type { SchedulerService } from "../../services/scheduler-service";

export interface AppServices {
  taskQueue: TaskQueueImpl;
  dbProvider: DatabaseProvider;
  repository: TaskRepositoryAdapter;
  schedulerService: SchedulerService;
  workerManager?: WorkerManager;
  wsServer?: WebSocketServer;
}

/**
 * Decorate Fastify app instance with services
 * @param app Fastify instance
 * @param services Services to decorate
 */
export function decorateApp(app: FastifyInstance, services: AppServices): void {
  app.decorate("queue", services.taskQueue);
  app.decorate("dbProvider", services.dbProvider);
  app.decorate("repository", services.repository);
  app.decorate("schedulerService", services.schedulerService);

  if (services.workerManager) {
    app.decorate("workerManager", services.workerManager);
  }

  if (services.wsServer) {
    app.decorate("wsServer", services.wsServer);
  }
}
