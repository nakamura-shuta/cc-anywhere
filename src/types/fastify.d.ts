import "fastify";
import type { TaskQueueImpl } from "../queue/task-queue";
import type { WebSocketServer } from "../websocket/websocket-server";
import type { WorkerManager } from "../worker/worker-manager";
import type { DatabaseProvider } from "../db/database-provider";
import type { TaskRepositoryAdapter } from "../repositories/task-repository-adapter";

declare module "fastify" {
  interface FastifyInstance {
    queue: TaskQueueImpl;
    wsServer?: WebSocketServer;
    workerManager?: WorkerManager;
    dbProvider: DatabaseProvider;
    repository: TaskRepositoryAdapter;
  }
}