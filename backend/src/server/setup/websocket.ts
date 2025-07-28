import type { FastifyInstance } from "fastify";
import type { TaskQueueImpl } from "../../queue";
import { WebSocketServer } from "../../websocket/websocket-server";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { getTypedEventBus } from "../../events";

/**
 * Configure WebSocket server and integrate with task queue
 * @param app Fastify instance
 * @param taskQueue Task queue instance
 * @returns WebSocket server instance or undefined if disabled
 */
export async function configureWebSocket(
  app: FastifyInstance,
  taskQueue: TaskQueueImpl,
): Promise<WebSocketServer | undefined> {
  if (config.websocket?.enabled === false) {
    return undefined;
  }

  const wsServer = new WebSocketServer({
    heartbeatInterval: config.websocket?.heartbeatInterval,
    heartbeatTimeout: config.websocket?.heartbeatTimeout,
    authTimeout: config.websocket?.authTimeout,
    maxLogBufferSize: config.websocket?.maxLogBufferSize,
  });

  await wsServer.register(app);
  app.decorate("wsServer", wsServer);

  // Set up WebSocket integration with task queue
  taskQueue.onTaskComplete((task) => {
    logger.info("Broadcasting task completion via WebSocket", {
      taskId: task.id,
      status: task.status,
    });

    wsServer.broadcastTaskUpdate({
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
    wsServer.broadcastTaskUpdate({
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
      wsServer.broadcastTaskUpdate({
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
  return wsServer;
}
