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
  | "task:reasoning"
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
}
