/**
 * Agent SDK Types
 *
 * Claude Agent SDK と Codex SDK の統一インターフェイス型定義
 */

import type { TimeoutOptions } from "../types/timeout.js";
import type { WorktreeOptions } from "../services/worktree/types.js";
import type { TodoItem } from "../types/todo.js";
import type { RetryOptions, TaskContext, ClaudeCodeSDKOptions } from "../claude/types.js";

/**
 * Agent executor type
 */
export type ExecutorType = "claude" | "codex";

/**
 * Executor type constants
 * 型安全な定数として使用
 */
export const EXECUTOR_TYPES = {
  CLAUDE: "claude" as const,
  CODEX: "codex" as const,
} as const;

/**
 * All available executor types as array
 */
export const ALL_EXECUTOR_TYPES: readonly ExecutorType[] = [
  EXECUTOR_TYPES.CLAUDE,
  EXECUTOR_TYPES.CODEX,
] as const;

/**
 * Codex SDK specific options
 * Phase 0検証結果を反映
 */
export interface CodexAgentOptions {
  /** 必須: ファイル操作を有効化するため workspace-write を推奨 */
  sandboxMode: "read-only" | "workspace-write" | "danger-full-access";

  /** Git リポジトリチェックをスキップ */
  skipGitRepoCheck?: boolean;

  /** 最大ターン数 */
  maxTurns?: number;

  /** 許可するツール */
  allowedTools?: string[];

  /** 禁止するツール */
  disallowedTools?: string[];

  /** システムプロンプト */
  systemPrompt?: string;

  /** セッション継続 */
  continueSession?: boolean;
  resumeSession?: string;

  /** Verbose モード */
  verbose?: boolean;
}

/**
 * Agent task request
 * 既存の TaskRequest を拡張し、executor 選択をサポート
 */
export interface AgentTaskRequest {
  /** タスクの指示内容 */
  instruction: string;

  /** タスクのコンテキスト */
  context?: TaskContext;

  /** 実行オプション */
  options?: {
    /** タイムアウト設定 */
    timeout?: number | TimeoutOptions;

    /** 非同期実行フラグ */
    async?: boolean;

    /** リトライ設定 */
    retry?: RetryOptions;

    /** Worktree設定 */
    useWorktree?: boolean;
    worktree?: WorktreeOptions;

    /** Executor選択（新規） */
    executor?: ExecutorType;

    /** Claude Agent SDK固有のオプション */
    claude?: ClaudeCodeSDKOptions;

    /** Codex SDK固有のオプション */
    codex?: CodexAgentOptions;

    /** 進捗コールバック */
    onProgress?: (event: AgentExecutionEvent) => void | Promise<void>;

    /** Cross-repository continuation */
    allowCrossRepository?: boolean;
  };
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  /** タスクID */
  taskId?: string;

  /** AbortController for cancellation */
  abortController?: AbortController;
}

/**
 * Tool statistics
 */
export interface ToolStatistics {
  count: number;
  successes: number;
  failures: number;
  totalDuration: number;
  avgDuration: number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  input: number;
  output: number;
  cached?: number;
}

/**
 * Agent execution events
 */

/** エグゼキューター開始イベント */
export interface AgentStartEvent {
  type: "agent:start";
  executor: ExecutorType;
  timestamp: Date;
}

/** 進捗イベント */
export interface AgentProgressEvent {
  type: "agent:progress";
  message: string;
  data?: {
    currentTurn?: number;
    maxTurns?: number;
  };
  timestamp: Date;
}

/** ツール実行開始イベント */
export interface AgentToolStartEvent {
  type: "agent:tool:start";
  tool: string;
  toolId?: string;
  input?: any;
  timestamp: Date;
}

/** ツール実行完了イベント */
export interface AgentToolEndEvent {
  type: "agent:tool:end";
  tool: string;
  toolId?: string;
  output?: any;
  error?: string;
  duration?: number;
  success: boolean;
  timestamp: Date;
}

/** Agentレスポンスイベント */
export interface AgentResponseEvent {
  type: "agent:response";
  text: string;
  turnNumber?: number;
  timestamp: Date;
}

/** 統計情報イベント */
export interface AgentStatisticsEvent {
  type: "agent:statistics";
  totalTurns: number;
  totalToolCalls: number;
  toolStats: Record<string, ToolStatistics>;
  elapsedTime: number;
  tokenUsage?: TokenUsage;
  timestamp: Date;
}

/** 完了イベント */
export interface AgentCompletedEvent {
  type: "agent:completed";
  output: unknown;
  sessionId?: string;
  conversationHistory?: any[];
  todos?: TodoItem[];
  duration: number;
  timestamp: Date;
}

/** 失敗イベント */
export interface AgentFailedEvent {
  type: "agent:failed";
  error: Error;
  timestamp: Date;
}

/**
 * Agent execution event union type
 */
export type AgentExecutionEvent =
  | AgentStartEvent
  | AgentProgressEvent
  | AgentToolStartEvent
  | AgentToolEndEvent
  | AgentResponseEvent
  | AgentStatisticsEvent
  | AgentCompletedEvent
  | AgentFailedEvent;

/**
 * Agent executor interface
 *
 * このインターフェイスは Claude Agent SDK と Codex SDK の
 * 両方を統一的に扱うための抽象化レイヤーを提供します。
 */
export interface IAgentExecutor {
  /**
   * タスクを実行する
   *
   * @param request タスクリクエスト
   * @param options 実行オプション
   * @returns 実行結果のAsyncIterator（ストリーミング）
   */
  executeTask(
    request: AgentTaskRequest,
    options: AgentExecutionOptions,
  ): AsyncIterator<AgentExecutionEvent>;

  /**
   * 実行中のタスクをキャンセルする
   *
   * @param taskId キャンセルするタスクのID
   */
  cancelTask(taskId: string): Promise<void>;

  /**
   * エグゼキュータの種類を取得
   *
   * @returns "claude" | "codex"
   */
  getExecutorType(): ExecutorType;

  /**
   * 使用可能かどうかをチェック
   *
   * @returns 使用可能な場合true
   */
  isAvailable(): boolean;
}

/**
 * Executor metadata for database storage
 */
export interface ExecutorMetadata {
  /** Executor version */
  executorVersion?: string;

  /** Claude-specific fields */
  claude?: {
    model?: string;
    executionMode?: "agent-sdk" | "bedrock" | "anthropic-api";
    apiVersion?: string;
    cachingEnabled?: boolean;
  };

  /** Codex-specific fields */
  codex?: {
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
    skipGitRepoCheck?: boolean;
    threadId?: string;
    codexVersion?: string;
  };

  /** Performance metrics (common) */
  performance?: {
    tokenUsage?: TokenUsage;
    apiCalls?: number;
    averageLatency?: number;
  };
}
