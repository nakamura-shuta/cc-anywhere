/**
 * Domain event definitions
 */

import type { TaskRequest, TaskResponse } from "../claude/types";

/**
 * Task lifecycle events
 */
export interface TaskCreatedEvent {
  taskId: string;
  request: TaskRequest;
  priority: number;
  createdAt: Date;
}

export interface TaskStartedEvent {
  taskId: string;
  startedAt: Date;
  workerId?: string;
}

export interface TaskCompletedEvent {
  taskId: string;
  result: TaskResponse;
  duration: number;
  completedAt: Date;
}

export interface TaskFailedEvent {
  taskId: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  failedAt: Date;
  willRetry: boolean;
  retryCount?: number;
}

export interface TaskCancelledEvent {
  taskId: string;
  reason?: string;
  cancelledAt: Date;
}

export interface TaskRetryScheduledEvent {
  taskId: string;
  attemptNumber: number;
  scheduledFor: Date;
  previousError: string;
}

/**
 * Worker lifecycle events
 */
export interface WorkerStartedEvent {
  workerId: string;
  startedAt: Date;
  capabilities?: string[];
}

export interface WorkerStoppedEvent {
  workerId: string;
  stoppedAt: Date;
  reason?: string;
}

export interface WorkerStatusChangedEvent {
  workerId: string;
  previousStatus: string;
  newStatus: string;
  changedAt: Date;
}

export interface WorkerHealthCheckEvent {
  workerId: string;
  status: "healthy" | "unhealthy";
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    activeTasks?: number;
  };
  checkedAt: Date;
}

/**
 * Queue events
 */
export interface QueueOverloadedEvent {
  queueSize: number;
  threshold: number;
  timestamp: Date;
}

export interface QueueDrainedEvent {
  timestamp: Date;
}

/**
 * WebSocket events
 */
export interface WebSocketClientConnectedEvent {
  clientId: string;
  connectedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface WebSocketClientDisconnectedEvent {
  clientId: string;
  disconnectedAt: Date;
  reason?: string;
}

/**
 * Configuration events
 */
export interface ConfigurationChangedEvent {
  key: string;
  previousValue: unknown;
  newValue: unknown;
  changedAt: Date;
}

/**
 * System events
 */
export interface SystemStartupEvent {
  version: string;
  environment: string;
  startedAt: Date;
}

export interface SystemShutdownEvent {
  reason?: string;
  shutdownAt: Date;
}

export interface RateLimitExceededEvent {
  resource: string;
  limit: number;
  windowMs: number;
  clientId?: string;
  exceededAt: Date;
}

/**
 * Error tracking events
 */
export interface ErrorOccurredEvent {
  error: {
    code: string;
    message: string;
    statusCode: number;
    name: string;
  };
  request: {
    method: string;
    url: string;
    id: string;
  };
  timestamp: Date;
}

/**
 * All domain events mapped by event type
 */
export interface DomainEventMap {
  // Task events
  "task.created": TaskCreatedEvent;
  "task.started": TaskStartedEvent;
  "task.completed": TaskCompletedEvent;
  "task.failed": TaskFailedEvent;
  "task.cancelled": TaskCancelledEvent;
  "task.retry.scheduled": TaskRetryScheduledEvent;

  // Worker events
  "worker.started": WorkerStartedEvent;
  "worker.stopped": WorkerStoppedEvent;
  "worker.status.changed": WorkerStatusChangedEvent;
  "worker.health.check": WorkerHealthCheckEvent;

  // Queue events
  "queue.overloaded": QueueOverloadedEvent;
  "queue.drained": QueueDrainedEvent;

  // WebSocket events
  "websocket.client.connected": WebSocketClientConnectedEvent;
  "websocket.client.disconnected": WebSocketClientDisconnectedEvent;

  // Configuration events
  "config.changed": ConfigurationChangedEvent;

  // System events
  "system.startup": SystemStartupEvent;
  "system.shutdown": SystemShutdownEvent;
  "system.ratelimit.exceeded": RateLimitExceededEvent;

  // Error events
  "error.occurred": ErrorOccurredEvent;
}

/**
 * Type-safe event names
 */
export type DomainEventType = keyof DomainEventMap;

/**
 * Type helper to get event payload type from event type
 */
export type DomainEventPayload<T extends DomainEventType> = DomainEventMap[T];
