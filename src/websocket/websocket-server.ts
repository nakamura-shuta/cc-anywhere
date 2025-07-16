import type { FastifyInstance } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";
import type {
  AuthenticatedWebSocket,
  WebSocketMessage,
  AuthMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  HeartbeatMessage,
  TaskUpdateMessage,
  LogStreamMessage,
  ErrorMessage,
  SuccessMessage,
  WebSocketServerOptions,
  WebSocketHandlers,
  ToolUsageMessage,
  TaskProgressMessage,
  TaskSummaryMessage,
  TodoUpdateMessage,
  ToolStartMessage,
  ToolEndMessage,
  ToolProgressMessage,
  TaskStatisticsMessage,
  ClaudeResponseMessage,
} from "./types.js";

export class WebSocketServer {
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly options: Required<WebSocketServerOptions>;
  private handlers: WebSocketHandlers = {};

  constructor(options: WebSocketServerOptions = {}) {
    this.options = {
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      heartbeatTimeout: options.heartbeatTimeout ?? 60000,
      maxLogBufferSize: options.maxLogBufferSize ?? 1000,
      authTimeout: options.authTimeout ?? 10000,
    };
  }

  async register(app: FastifyInstance): Promise<void> {
    // Register WebSocket plugin
    await app.register(fastifyWebsocket);

    // Register WebSocket route
    await app.register(async (fastify) => {
      fastify.get("/ws", { websocket: true }, (connection) => {
        // connection is the WebSocket connection object
        const ws = connection;
        // Initialize properties on the WebSocket object
        Object.assign(ws, {
          id: randomUUID(),
          authenticated: false,
          subscriptions: new Set(),
          lastActivity: Date.now(),
          logBuffer: [],
          timers: [],
        });

        this.handleConnection(ws as AuthenticatedWebSocket);
      });
    });

    // Start heartbeat checker
    this.startHeartbeatChecker();

    logger.info("WebSocket server registered");
  }

  private handleConnection(ws: AuthenticatedWebSocket): void {
    // Client is already initialized in the route handler
    // Just update lastHeartbeat
    ws.lastHeartbeat = Date.now();

    // Add to clients map
    this.clients.set(ws.id, ws);

    logger.info(`WebSocket client connected: ${ws.id}`);

    // Set up auth timeout
    const authTimeout = setTimeout(() => {
      if (!ws.authenticated) {
        this.sendError(ws, "Authentication timeout", "AUTH_TIMEOUT");
        ws.close(1008, "Authentication timeout");
      }
    }, this.options.authTimeout);

    // Set up event handlers
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, "Invalid message format", "INVALID_MESSAGE");
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      this.handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      logger.error(`WebSocket error for client ${ws.id}:`, error);
      ws.close(1011, "Internal error");
    });

    // Send initial message
    this.sendMessage(ws, {
      type: "connection",
      payload: {
        message: "Connected to WebSocket server. Please authenticate.",
      },
    });
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    // Update heartbeat
    ws.lastHeartbeat = Date.now();

    // Handle authentication first
    if (!ws.authenticated && message.type !== "auth") {
      this.sendError(ws, "Authentication required", "AUTH_REQUIRED");
      return;
    }

    switch (message.type) {
      case "auth":
        this.handleAuth(ws, message as AuthMessage);
        break;
      case "subscribe":
        this.handleSubscribe(ws, message as SubscribeMessage);
        break;
      case "unsubscribe":
        this.handleUnsubscribe(ws, message as UnsubscribeMessage);
        break;
      case "ping":
        this.handlePing(ws, message as HeartbeatMessage);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`, "UNKNOWN_MESSAGE");
    }
  }

  private handleAuth(ws: AuthenticatedWebSocket, message: AuthMessage): void {
    const { apiKey } = message.payload;

    // Check if authentication is enabled
    if (!config.auth.enabled) {
      // If auth is disabled, always authenticate
      ws.authenticated = true;
      ws.apiKey = "no-auth";
    } else if (apiKey && apiKey === config.auth.apiKey) {
      // Validate API key
      ws.authenticated = true;
      ws.apiKey = apiKey;
    } else {
      // Invalid API key
      const errorMessage: ErrorMessage = {
        type: "error",
        payload: {
          message: "Invalid API key",
          code: "INVALID_API_KEY",
        },
      };
      this.sendMessage(ws, errorMessage);
      return;
    }

    if (ws.authenticated) {
      const successMessage: SuccessMessage = {
        type: "auth:success",
        payload: {
          message: "Authenticated successfully",
        },
      };
      this.sendMessage(ws, successMessage);

      logger.info(`WebSocket client authenticated: ${ws.id}`);

      if (this.handlers.onAuthenticated) {
        this.handlers.onAuthenticated(ws);
      }
    } else {
      this.sendError(ws, "Invalid API key", "INVALID_API_KEY");
      ws.close(1008, "Invalid API key");
    }
  }

  private handleSubscribe(ws: AuthenticatedWebSocket, message: SubscribeMessage): void {
    const { taskId } = message.payload;

    if (!taskId) {
      this.sendError(ws, "Task ID required", "INVALID_SUBSCRIBE");
      return;
    }

    ws.subscriptions.add(taskId);

    const successMessage: SuccessMessage = {
      type: "subscribe:success",
      payload: {
        taskId,
      },
    };
    this.sendMessage(ws, successMessage);

    logger.info(`Client ${ws.id} subscribed to task ${taskId}`, {
      clientId: ws.id,
      taskId,
      totalSubscriptions: ws.subscriptions.size,
      allSubscriptions: Array.from(ws.subscriptions),
    });

    if (this.handlers.onTaskSubscribe) {
      this.handlers.onTaskSubscribe(ws, taskId);
    }
  }

  private handleUnsubscribe(ws: AuthenticatedWebSocket, message: UnsubscribeMessage): void {
    const { taskId } = message.payload;

    if (!taskId) {
      this.sendError(ws, "Task ID required", "INVALID_UNSUBSCRIBE");
      return;
    }

    ws.subscriptions.delete(taskId);

    const successMessage: SuccessMessage = {
      type: "unsubscribe:success",
      payload: {
        taskId,
      },
    };
    this.sendMessage(ws, successMessage);

    logger.debug(`Client ${ws.id} unsubscribed from task ${taskId}`);

    if (this.handlers.onTaskUnsubscribe) {
      this.handlers.onTaskUnsubscribe(ws, taskId);
    }
  }

  private handlePing(ws: AuthenticatedWebSocket, _message: HeartbeatMessage): void {
    const pongMessage: HeartbeatMessage = {
      type: "pong",
      payload: {
        timestamp: Date.now(),
      },
    };
    this.sendMessage(ws, pongMessage);
  }

  private handleDisconnect(ws: AuthenticatedWebSocket): void {
    this.clients.delete(ws.id);

    logger.info(`WebSocket client disconnected: ${ws.id}`);

    if (this.handlers.onDisconnect) {
      this.handlers.onDisconnect(ws);
    }

    // Clean up resources
    ws.subscriptions.clear();
    ws.logBuffer = [];
  }

  private startHeartbeatChecker(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.heartbeatTimeout;

      for (const [id, client] of this.clients) {
        if (now - client.lastHeartbeat > timeout) {
          logger.warn(`Client ${id} timed out, disconnecting`);
          client.close(1001, "Connection timeout");
          this.clients.delete(id);
        }
      }
    }, this.options.heartbeatInterval);
  }

  // Public methods for broadcasting messages

  broadcastTaskUpdate(update: TaskUpdateMessage["payload"]): void {
    const message: TaskUpdateMessage = {
      type: "task:update",
      payload: update,
    };

    this.broadcastToTaskSubscribers(update.taskId, message);
  }

  broadcastTaskLog(log: LogStreamMessage["payload"]): void {
    const message: LogStreamMessage = {
      type: "task:log",
      payload: log,
    };

    logger.debug("Broadcasting task log", {
      taskId: log.taskId,
      subscriberCount: Array.from(this.clients.values()).filter(
        (c) => c.authenticated && c.subscriptions.has(log.taskId),
      ).length,
    });

    // Add to buffer and broadcast
    for (const client of this.clients.values()) {
      if (client.authenticated && client.subscriptions.has(log.taskId)) {
        // Add to client's log buffer
        client.logBuffer.push({
          type: "task:log",
          payload: log,
        });
        this.trimLogBuffer(client);

        // Send the message
        this.sendMessage(client, message);
        logger.debug("Sent log to client", { clientId: client.id, taskId: log.taskId });
      }
    }
  }

  broadcastToolUsage(usage: ToolUsageMessage["payload"]): void {
    const message: ToolUsageMessage = {
      type: "task:tool_usage",
      payload: usage,
    };

    this.broadcastToTaskSubscribers(usage.taskId, message);
  }

  broadcastTaskProgress(progress: TaskProgressMessage["payload"]): void {
    const message: TaskProgressMessage = {
      type: "task:progress",
      payload: progress,
    };

    this.broadcastToTaskSubscribers(progress.taskId, message);
  }

  broadcastTaskSummary(summary: TaskSummaryMessage["payload"]): void {
    const message: TaskSummaryMessage = {
      type: "task:summary",
      payload: summary,
    };

    this.broadcastToTaskSubscribers(summary.taskId, message);
  }

  broadcastTodoUpdate(update: TodoUpdateMessage["payload"]): void {
    const message: TodoUpdateMessage = {
      type: "task:todo_update",
      payload: update,
    };

    this.broadcastToTaskSubscribers(update.taskId, message);
  }

  // New streaming event methods
  broadcastToolStart(payload: ToolStartMessage["payload"]): void {
    const message: ToolStartMessage = {
      type: "task:tool:start",
      payload,
    };

    this.broadcastToTaskSubscribers(payload.taskId, message);
  }

  broadcastToolEnd(payload: ToolEndMessage["payload"]): void {
    const message: ToolEndMessage = {
      type: "task:tool:end",
      payload,
    };

    this.broadcastToTaskSubscribers(payload.taskId, message);
  }

  broadcastToolProgress(payload: ToolProgressMessage["payload"]): void {
    const message: ToolProgressMessage = {
      type: "task:tool:progress",
      payload,
    };

    this.broadcastToTaskSubscribers(payload.taskId, message);
  }

  broadcastTaskStatistics(payload: TaskStatisticsMessage["payload"]): void {
    const message: TaskStatisticsMessage = {
      type: "task:statistics",
      payload,
    };

    this.broadcastToTaskSubscribers(payload.taskId, message);
  }

  broadcastClaudeResponse(payload: ClaudeResponseMessage["payload"]): void {
    const message: ClaudeResponseMessage = {
      type: "task:claude:response",
      payload,
    };

    this.broadcastToTaskSubscribers(payload.taskId, message);
  }

  private broadcastToTaskSubscribers(taskId: string, message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      if (client.authenticated && client.subscriptions.has(taskId)) {
        this.sendMessage(client, message);
      }
    }
  }

  broadcastToAll(message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      if (client.authenticated) {
        this.sendMessage(client, message);
      }
    }
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    try {
      if (ws.readyState === ws.OPEN) {
        // メッセージサイズのチェックと必要に応じて切り詰め
        let messageToSend = message;
        
        // 大きな文字列データを含む可能性のあるフィールドを切り詰める
        const truncatePayloadField = (payload: any, fieldName: string, maxLength: number = 5000): any => {
          if (payload && payload[fieldName] && typeof payload[fieldName] === 'string' && payload[fieldName].length > maxLength) {
            return {
              ...payload,
              [fieldName]: payload[fieldName].substring(0, maxLength) + `\n... (truncated ${payload[fieldName].length - maxLength} characters)`,
            };
          }
          return payload;
        };
        
        // 各メッセージタイプごとに大きなフィールドを切り詰める
        if (message.payload) {
          let truncatedPayload = message.payload as any;
          
          switch (message.type) {
            case 'task:tool:end':
              truncatedPayload = truncatePayloadField(truncatedPayload, 'output', 5000);
              truncatedPayload = truncatePayloadField(truncatedPayload, 'error', 2000);
              break;
              
            case 'task:tool:start':
              // inputフィールドも大きくなる可能性がある（ファイル内容など）
              if (truncatedPayload.input && typeof truncatedPayload.input === 'object') {
                const input = truncatedPayload.input;
                if (input.content && typeof input.content === 'string' && input.content.length > 2000) {
                  truncatedPayload = {
                    ...truncatedPayload,
                    input: {
                      ...input,
                      content: input.content.substring(0, 2000) + '... (truncated)',
                    },
                  };
                }
              }
              break;
              
            case 'task:log':
              truncatedPayload = truncatePayloadField(truncatedPayload, 'log', 2000);
              break;
              
            case 'task:claude:response':
              truncatedPayload = truncatePayloadField(truncatedPayload, 'text', 5000);
              break;
          }
          
          if (truncatedPayload !== message.payload) {
            messageToSend = {
              ...message,
              payload: truncatedPayload,
            };
            logger.warn(`Truncated large payload for message type: ${message.type}`, {
              clientId: ws.id,
            });
          }
        }
        
        const messageStr = JSON.stringify(messageToSend);
        
        // メッセージサイズが大きすぎる場合の警告
        if (messageStr.length > 50000) {
          logger.warn(`Large WebSocket message: ${messageStr.length} bytes`, {
            clientId: ws.id,
            messageType: message.type,
          });
          
          // 50KB以上のメッセージは警告メッセージに置き換える
          if (messageStr.length > 100000) {
            const warningMessage = {
              type: 'task:log',
              payload: {
                taskId: (message.payload as any)?.taskId || 'unknown',
                log: `[システム] 大きなメッセージ（${Math.round(messageStr.length / 1024)}KB）は省略されました`,
                timestamp: new Date().toISOString(),
              },
            };
            ws.send(JSON.stringify(warningMessage));
            return;
          }
        }
        
        try {
          ws.send(messageStr);
        } catch (sendError) {
          logger.error(`Failed to send message to client ${ws.id}:`, sendError);
        }
      }
    } catch (error) {
      logger.error(`Failed to send message to client ${ws.id}:`, error);
      logger.error(`Message type that caused error: ${message.type}`);
    }
  }

  private sendError(ws: AuthenticatedWebSocket, message: string, code: string): void {
    const errorMessage: ErrorMessage = {
      type: "error",
      payload: {
        message,
        code,
      },
    };
    this.sendMessage(ws, errorMessage);
  }

  // Set handlers
  setHandlers(handlers: WebSocketHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // Log buffer management
  private trimLogBuffer(ws: AuthenticatedWebSocket, maxSize: number = 100): void {
    if (ws.logBuffer.length > maxSize) {
      // Keep only the most recent logs
      ws.logBuffer = ws.logBuffer.slice(-maxSize);
    }
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.close(1001, "Server shutting down");
    }

    this.clients.clear();
    logger.info("WebSocket server closed");
  }

  // Get stats
  getStats(): {
    totalClients: number;
    authenticatedClients: number;
    subscriptions: Record<string, number>;
  } {
    const stats = {
      totalClients: this.clients.size,
      authenticatedClients: 0,
      subscriptions: {} as Record<string, number>,
    };

    for (const client of this.clients.values()) {
      if (client.authenticated) {
        stats.authenticatedClients++;
      }
      for (const taskId of client.subscriptions) {
        stats.subscriptions[taskId] = (stats.subscriptions[taskId] || 0) + 1;
      }
    }

    return stats;
  }
}
