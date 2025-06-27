import "fastify";
import type { TaskQueueImpl } from "../queue/task-queue";
import type { WebSocketServer } from "../websocket/websocket-server";
import type { WorkerManager } from "../worker/worker-manager";

declare module "fastify" {
  interface FastifyInstance {
    queue: TaskQueueImpl;
    wsServer?: WebSocketServer;
    workerManager?: WorkerManager;
  }
}