import type { WebSocketServer } from "./websocket-server.js";
import type { WebSocketMessage } from "./types.js";
import { logger } from "../utils/logger.js";

export type MessageType =
  | "task:update"
  | "task:log"
  | "task:tool_usage"
  | "task:tool:start"
  | "task:tool:end"
  | "task:tool:progress"
  | "task:progress"
  | "task:todo_update"
  | "task:summary"
  | "task:statistics"
  | "task:claude_response"
  | "schedule:update"
  | "schedule:execution"
  | "task-group:created"
  | "task-group:status"
  | "task-group:progress"
  | "task-group:task_completed"
  | "task-group:log"
  | "file:change";

export interface BroadcastOptions {
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * WebSocketBroadcaster - 統一されたWebSocket通信ハンドラー
 *
 * 既存の20以上のbroadcastメソッドを1つの汎用的なメソッドで置き換える
 */
export class WebSocketBroadcaster {
  constructor(private wsServer: WebSocketServer) {}

  /**
   * ジェネリックな配信メソッド
   *
   * @param channel - 配信チャンネル（例: "task-123", "group-456", "global"）
   * @param messageType - メッセージタイプ
   * @param payload - ペイロード
   * @param options - 追加オプション
   */
  broadcast<T = unknown>(
    channel: string,
    messageType: MessageType | string,
    payload: T,
    options: BroadcastOptions = {},
  ): void {
    const message: WebSocketMessage = {
      type: messageType,
      payload: {
        ...payload,
        timestamp: options.timestamp || new Date().toISOString(),
        ...(options.metadata && { metadata: options.metadata }),
      },
    };

    logger.debug(`Broadcasting message: ${messageType} to channel: ${channel}`);

    // チャンネルに応じた配信
    if (channel === "global" || channel === "*") {
      // 全クライアントに配信
      this.wsServer.broadcastToAll(message);
    } else if (channel.startsWith("task-")) {
      // タスク購読者に配信
      const taskId = channel.replace("task-", "");
      this.broadcastToTaskSubscribers(taskId, message);
    } else if (channel.startsWith("group-")) {
      // グループ関連は全体配信（現状の動作に合わせる）
      this.wsServer.broadcastToAll(message);
    } else {
      // その他のカスタムチャンネル
      this.wsServer.broadcastToAll(message);
    }
  }

  /**
   * タスク購読者への配信
   *
   * @param _taskId - タスクID（将来的な実装のために保持）
   * @param message - 配信メッセージ
   */
  private broadcastToTaskSubscribers(_taskId: string, message: WebSocketMessage): void {
    // WebSocketServerのprivateメソッドにアクセスできないため、
    // 一時的にbroadcastToAllを使用（後でWebSocketServerをリファクタリング）
    this.wsServer.broadcastToAll(message);
  }

  /**
   * タスク関連のメッセージ配信のヘルパーメソッド
   */
  task(taskId: string, messageType: MessageType, payload: any): void {
    this.broadcast(`task-${taskId}`, messageType, { taskId, ...payload });
  }

  /**
   * タスクグループ関連のメッセージ配信のヘルパーメソッド
   */
  taskGroup(groupId: string, messageType: MessageType, payload: any): void {
    this.broadcast(`group-${groupId}`, messageType, { groupId, ...payload });
  }

  /**
   * グローバル配信のヘルパーメソッド
   */
  global(messageType: MessageType | string, payload: any): void {
    this.broadcast("global", messageType, payload);
  }

  /**
   * 従来のメソッドとの後方互換性のためのラッパー
   * 段階的な移行のために一時的に残す
   */
  legacy = {
    broadcastTaskUpdate: (payload: any) => this.task(payload.taskId, "task:update", payload),

    broadcastTaskLog: (payload: any) => this.task(payload.taskId, "task:log", payload),

    broadcastToolUsage: (payload: any) => this.task(payload.taskId, "task:tool_usage", payload),

    broadcastTaskProgress: (payload: any) => this.task(payload.taskId, "task:progress", payload),

    broadcastTaskSummary: (payload: any) => this.task(payload.taskId, "task:summary", payload),

    broadcastTodoUpdate: (payload: any) => this.task(payload.taskId, "task:todo_update", payload),

    broadcastToolStart: (payload: any) => this.task(payload.taskId, "task:tool:start", payload),

    broadcastToolEnd: (payload: any) => this.task(payload.taskId, "task:tool:end", payload),

    broadcastToolProgress: (payload: any) =>
      this.task(payload.taskId, "task:tool:progress", payload),

    broadcastTaskStatistics: (payload: any) =>
      this.task(payload.taskId, "task:statistics", payload),

    broadcastClaudeResponse: (payload: any) =>
      this.task(payload.taskId, "task:claude_response", payload),

    broadcastScheduleUpdate: (payload: any) => this.global("schedule:update", payload),

    broadcastScheduleExecution: (payload: any) => this.global("schedule:execution", payload),

    broadcastTaskGroupCreated: (payload: any) =>
      this.taskGroup(payload.groupId, "task-group:created", payload),

    broadcastTaskGroupStatus: (payload: any) =>
      this.taskGroup(payload.groupId, "task-group:status", payload),

    broadcastTaskGroupProgress: (payload: any) =>
      this.taskGroup(payload.groupId, "task-group:progress", payload),

    broadcastTaskGroupTaskCompleted: (payload: any) =>
      this.taskGroup(payload.groupId, "task-group:task_completed", payload),

    broadcastTaskGroupLog: (payload: any) =>
      this.taskGroup(payload.groupId, "task-group:log", payload),

    broadcastFileChange: (event: any) => this.global("file:change", event),
  };
}
