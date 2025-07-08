import type { TaskQueue } from "../queue/types.js";
import type { WebSocketServer } from "../websocket/websocket-server.js";
import type { WorkerManager } from "../worker/worker-manager.js";
import type { ErrorDetails } from "../utils/errors.js";

// API Error Response types
export interface ErrorResponse {
  error: ErrorDetails & {
    originalMessage?: string;
  };
}

// Health check response
export interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  environment: string;
}

// Task log response
export interface TaskLogResponse {
  taskId: string;
  logs: string[];
}

// Task cancel response
export interface TaskCancelResponse {
  message: string;
  taskId: string;
}

// Extend Fastify instance type to include queue and WebSocket server
declare module "fastify" {
  interface FastifyInstance {
    queue: TaskQueue;
    wsServer?: WebSocketServer;
    workerManager?: WorkerManager;
  }
}
