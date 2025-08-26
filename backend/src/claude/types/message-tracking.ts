/**
 * UUID-based Message Tracking Types
 * Claude Code SDK 1.0.86+ のUUID機能を活用したメッセージトラッキング
 */

import type { SDKMessage } from "@anthropic-ai/claude-code";

/**
 * UUID付きメッセージエンティティ
 */
export interface TrackedMessage {
  // メッセージの一意識別子（SDK提供）
  uuid: string;

  // タスクID
  taskId: string;

  // セッションID
  sessionId: string;

  // メッセージタイプ
  type: "system" | "user" | "assistant" | "result";

  // メッセージ内容
  content: unknown;

  // タイムスタンプ
  timestamp: Date;

  // 親ツール使用ID（存在する場合）
  parentToolUseId?: string;

  // メタデータ
  metadata?: {
    toolName?: string;
    toolUseId?: string;
    duration?: number;
    tokenCount?: number;
  };
}

/**
 * メッセージトラッキングストア
 */
export class MessageTracker {
  private messages = new Map<string, TrackedMessage>();
  private messagesByTask = new Map<string, Set<string>>();
  private duplicateCheck = new Set<string>();

  /**
   * メッセージを記録
   */
  track(taskId: string, message: SDKMessage): TrackedMessage | null {
    // UUIDが存在しない場合はスキップ（古いSDKバージョン対応）
    if (!("uuid" in message)) {
      return null;
    }

    const uuid = (message as any).uuid as string;

    // 重複チェック
    if (this.duplicateCheck.has(uuid)) {
      return null;
    }

    const trackedMessage: TrackedMessage = {
      uuid,
      taskId,
      sessionId: (message as any).session_id || "",
      type: message.type,
      content: this.extractContent(message),
      timestamp: new Date(),
      parentToolUseId: (message as any).parent_tool_use_id,
      metadata: this.extractMetadata(message),
    };

    // 保存
    this.messages.set(uuid, trackedMessage);
    this.duplicateCheck.add(uuid);

    // タスクごとのインデックス更新
    if (!this.messagesByTask.has(taskId)) {
      this.messagesByTask.set(taskId, new Set());
    }
    this.messagesByTask.get(taskId)!.add(uuid);

    return trackedMessage;
  }

  /**
   * メッセージ内容を抽出
   */
  private extractContent(message: SDKMessage): unknown {
    switch (message.type) {
      case "assistant":
        return (message as any).message?.content || null;
      case "user":
        return (message as any).message || null;
      case "result":
        return {
          subtype: (message as any).subtype,
          result: (message as any).result,
          error: (message as any).error,
        };
      case "system":
        return {
          subtype: (message as any).subtype,
          model: (message as any).model,
          tools: (message as any).tools,
        };
      default:
        return message;
    }
  }

  /**
   * メタデータを抽出
   */
  private extractMetadata(message: SDKMessage): TrackedMessage["metadata"] {
    const metadata: TrackedMessage["metadata"] = {};

    if (message.type === "result") {
      const resultMsg = message as any;
      if (resultMsg.duration_ms) {
        metadata.duration = resultMsg.duration_ms;
      }
      if (resultMsg.usage?.total_tokens) {
        metadata.tokenCount = resultMsg.usage.total_tokens;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  /**
   * UUIDでメッセージを取得
   */
  getByUuid(uuid: string): TrackedMessage | undefined {
    return this.messages.get(uuid);
  }

  /**
   * タスクIDで全メッセージを取得
   */
  getByTaskId(taskId: string): TrackedMessage[] {
    const messageUuids = this.messagesByTask.get(taskId);
    if (!messageUuids) return [];

    return Array.from(messageUuids)
      .map((uuid) => this.messages.get(uuid))
      .filter((msg): msg is TrackedMessage => msg !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 重複メッセージのチェック
   */
  isDuplicate(uuid: string): boolean {
    return this.duplicateCheck.has(uuid);
  }

  /**
   * タスクの統計情報を取得
   */
  getTaskStats(taskId: string): {
    totalMessages: number;
    messageTypes: Record<string, number>;
    totalDuration?: number;
    totalTokens?: number;
  } {
    const messages = this.getByTaskId(taskId);

    const stats = {
      totalMessages: messages.length,
      messageTypes: {} as Record<string, number>,
      totalDuration: 0,
      totalTokens: 0,
    };

    messages.forEach((msg) => {
      // メッセージタイプのカウント
      stats.messageTypes[msg.type] = (stats.messageTypes[msg.type] || 0) + 1;

      // メタデータの集計
      if (msg.metadata?.duration) {
        stats.totalDuration += msg.metadata.duration;
      }
      if (msg.metadata?.tokenCount) {
        stats.totalTokens += msg.metadata.tokenCount;
      }
    });

    return stats;
  }

  /**
   * メモリクリア（メモリ管理）
   */
  clearTask(taskId: string): void {
    const messageUuids = this.messagesByTask.get(taskId);
    if (messageUuids) {
      messageUuids.forEach((uuid) => {
        this.messages.delete(uuid);
        this.duplicateCheck.delete(uuid);
      });
      this.messagesByTask.delete(taskId);
    }
  }
}

// シングルトンインスタンス
export const messageTracker = new MessageTracker();
