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

// Enhanced logging messages
export interface ToolUsageMessage extends WebSocketMessage {
  type: "task:tool_usage";
  payload: {
    taskId: string;
    tool: {
      tool: string;
      status: "start" | "success" | "failure";
      filePath?: string;
      command?: string;
      pattern?: string;
      url?: string;
      error?: string;
      timestamp: string;
    };
  };
}

// Streaming tool events
export interface ToolStartMessage extends WebSocketMessage {
  type: "task:tool:start";
  payload: {
    taskId: string;
    toolId: string;
    tool: string;
    input?: any;
    formattedInput?: string; // Human-readable formatted input for display
    timestamp: string;
  };
}

export interface ToolEndMessage extends WebSocketMessage {
  type: "task:tool:end";
  payload: {
    taskId: string;
    toolId: string;
    tool: string;
    output?: any;
    error?: any;
    duration: number;
    success: boolean;
    timestamp: string;
  };
}

export interface ToolProgressMessage extends WebSocketMessage {
  type: "task:tool:progress";
  payload: {
    taskId: string;
    toolId: string;
    tool: string;
    progress: string;
    timestamp: string;
  };
}

export interface TaskProgressMessage extends WebSocketMessage {
  type: "task:progress";
  payload: {
    taskId: string;
    progress: {
      phase: "setup" | "planning" | "execution" | "cleanup" | "complete";
      message: string;
      level: "debug" | "info" | "tool" | "warning" | "error" | "success";
      timestamp: string;
    };
  };
}

export interface TodoUpdateMessage extends WebSocketMessage {
  type: "task:todo_update";
  payload: {
    taskId: string;
    todos: Array<{
      id: string;
      content: string;
      status: "pending" | "in_progress" | "completed";
      priority: "high" | "medium" | "low";
    }>;
  };
}

export interface TaskSummaryMessage extends WebSocketMessage {
  type: "task:summary";
  payload: {
    taskId: string;
    summary: {
      totalDuration: number;
      toolsUsed: Array<{
        tool: string;
        count: number;
        successCount: number;
        failureCount: number;
        details: string[];
      }>;
      filesModified: string[];
      filesRead: string[];
      filesCreated: string[];
      commandsExecuted: Array<{
        command: string;
        success: boolean;
      }>;
      errors: Array<{
        message: string;
        tool?: string;
        timestamp: string;
      }>;
      outcome: "success" | "partial_success" | "failure";
      highlights: string[];
    };
  };
}

// Real-time statistics
export interface TaskStatisticsMessage extends WebSocketMessage {
  type: "task:statistics";
  payload: {
    taskId: string;
    statistics: {
      totalTurns: number;
      totalToolCalls: number;
      toolStats: Record<
        string,
        {
          count: number;
          successes: number;
          failures: number;
          totalDuration: number;
          avgDuration: number;
        }
      >;
      currentPhase: string;
      elapsedTime: number;
    };
  };
}

// Claude response message
export interface ClaudeResponseMessage extends WebSocketMessage {
  type: "task:claude:response";
  payload: {
    taskId: string;
    text: string;
    turnNumber: number;
    maxTurns?: number;
    timestamp: string;
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

// Schedule-related messages
export interface ScheduleUpdateMessage extends WebSocketMessage {
  type: "schedule:update";
  payload: {
    scheduleId: string;
    status: "active" | "inactive" | "completed" | "failed";
    metadata?: {
      lastExecutedAt?: Date;
      nextExecuteAt?: Date;
      executionCount?: number;
    };
    timestamp: string;
  };
}

export interface ScheduleExecutionMessage extends WebSocketMessage {
  type: "schedule:execution";
  payload: {
    scheduleId: string;
    taskId: string;
    status: "started" | "completed" | "failed";
    error?: string;
    timestamp: string;
  };
}

export interface FileChangeMessage extends WebSocketMessage {
  type: "file-change";
  payload: {
    taskId: string;
    operation: 'add' | 'change' | 'delete' | 'rename';
    path: string;
    timestamp: number;
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
