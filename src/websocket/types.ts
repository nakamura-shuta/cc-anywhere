import type { WebSocket } from "ws";

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  payload?: unknown;
}

// Client -> Server messages
export interface AuthMessage extends WebSocketMessage {
  type: "auth";
  payload: {
    apiKey: string;
  };
}

export interface SubscribeMessage extends WebSocketMessage {
  type: "subscribe";
  payload: {
    taskId: string;
  };
}

export interface UnsubscribeMessage extends WebSocketMessage {
  type: "unsubscribe";
  payload: {
    taskId: string;
  };
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: "ping" | "pong";
  payload?: {
    timestamp: number;
  };
}

// Server -> Client messages
export interface TaskUpdateMessage extends WebSocketMessage {
  type: "task:update";
  payload: {
    taskId: string;
    status: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
}

export interface LogStreamMessage extends WebSocketMessage {
  type: "task:log";
  payload: {
    taskId: string;
    log: string;
    timestamp: string;
    level?: "info" | "warning" | "error" | "debug";
  };
}

import type { ErrorDetails } from "../utils/errors";

export interface ErrorMessage extends WebSocketMessage {
  type: "error";
  payload: Pick<ErrorDetails, "message" | "code" | "details">;
}

export interface SuccessMessage extends WebSocketMessage {
  type: "auth:success" | "subscribe:success" | "unsubscribe:success";
  payload?: {
    message?: string;
    [key: string]: unknown;
  };
}

// Extended WebSocket with authentication and subscriptions
export interface AuthenticatedWebSocket extends WebSocket {
  id: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  lastHeartbeat: number;
  logBuffer: LogStreamMessage[];
  apiKey?: string;
}

// WebSocket server options
export interface WebSocketServerOptions {
  heartbeatInterval?: number; // Default: 30000 (30 seconds)
  heartbeatTimeout?: number; // Default: 60000 (60 seconds)
  maxLogBufferSize?: number; // Default: 1000
  authTimeout?: number; // Default: 10000 (10 seconds)
}

// WebSocket event handlers
export interface WebSocketHandlers {
  onAuthenticated?: (ws: AuthenticatedWebSocket) => void;
  onTaskSubscribe?: (ws: AuthenticatedWebSocket, taskId: string) => void;
  onTaskUnsubscribe?: (ws: AuthenticatedWebSocket, taskId: string) => void;
  onDisconnect?: (ws: AuthenticatedWebSocket) => void;
}
