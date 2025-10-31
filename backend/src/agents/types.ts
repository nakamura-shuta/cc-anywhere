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
/**
 * 全Executorで共通のベースオプション
 * 全てのExecutorがサポートすべき最小限のパラメータ
 */
export interface BaseExecutorOptions {
  /** 詳細ログモード */
  verbose?: boolean;

  /** セッション継続フラグ */
  continueSession?: boolean;

  /** 再開するセッションID */
  resumeSession?: string;
}

/**
 * 多くのExecutorでサポートされる可能性の高いパラメータ
 * サポートしないExecutorは無視することができる
 */
export interface CommonExecutorOptions extends BaseExecutorOptions {
  /** 最大ターン数 */
  maxTurns?: number;

  /** 許可するツールのリスト */
  allowedTools?: string[];

  /** 禁止するツールのリスト */
  disallowedTools?: string[];

  /** カスタムシステムプロンプト */
  systemPrompt?: string;

  /** 出力フォーマット */
  outputFormat?: "text" | "json" | "stream-json";
}

/**
 * Executorの機能フラグ
 * 各Executorがどの機能をサポートしているかを示す
 */
export interface ExecutorCapabilities {
  // セッション管理
  sessionContinuation: boolean; // セッション継続
  sessionResume: boolean; // セッションID指定での再開
  crossRepositorySession: boolean; // リポジトリ跨ぎセッション

  // ターン制御
  maxTurnsLimit: boolean; // 最大ターン数制限

  // ツール制御
  toolFiltering: boolean; // ツールの許可/禁止

  // 権限制御
  permissionModes: boolean; // 権限モード設定

  // プロンプト制御
  customSystemPrompt: boolean; // カスタムシステムプロンプト

  // 出力制御
  outputFormatting: boolean; // 出力フォーマット指定
  verboseMode: boolean; // 詳細ログモード

  // サンドボックス
  sandboxControl: boolean; // サンドボックスモード制御

  // その他
  modelSelection: boolean; // モデル選択
  webSearch: boolean; // Web検索
}

/**
 * 各Executorの機能マトリックス
 * 新しいExecutorを追加する際はここに定義を追加
 */
export const EXECUTOR_CAPABILITIES: Record<ExecutorType, ExecutorCapabilities> = {
  claude: {
    sessionContinuation: true,
    sessionResume: true,
    crossRepositorySession: true,
    maxTurnsLimit: true,
    toolFiltering: true,
    permissionModes: true,
    customSystemPrompt: true,
    outputFormatting: true,
    verboseMode: true,
    sandboxControl: false,
    modelSelection: false,
    webSearch: true,
  },
  codex: {
    sessionContinuation: false, // 🔴 未実装（SDK検証済み、統合実装が必要）
    sessionResume: false, // 🔴 未実装（SDK的にはresumeThread()で可能、統合実装が必要）
    crossRepositorySession: false,
    maxTurnsLimit: false, // SDK未サポート
    toolFiltering: false, // SDK未サポート
    permissionModes: false, // SDK未サポート
    customSystemPrompt: false, // SDK未サポート
    outputFormatting: false, // SDK未サポート
    verboseMode: false, // SDK未サポート
    sandboxControl: true,
    modelSelection: true,
    webSearch: false,
  },
};

/**
 * 指定されたExecutorが特定の機能をサポートしているかチェック
 *
 * @param executor チェック対象のExecutor
 * @param feature チェックする機能
 * @returns サポートしている場合true
 *
 * @example
 * if (supportsFeature('codex', 'maxTurnsLimit')) {
 *   // maxTurnsをサポートしている
 * }
 */
export function supportsFeature(
  executor: ExecutorType,
  feature: keyof ExecutorCapabilities,
): boolean {
  return EXECUTOR_CAPABILITIES[executor][feature];
}

/**
 * サポートされていないオプションを検出
 *
 * @param executor チェック対象のExecutor
 * @param options チェックするオプション
 * @returns サポートされていないパラメータ名のリスト
 *
 * @example
 * const unsupported = detectUnsupportedOptions('codex', options);
 * if (unsupported.length > 0) {
 *   logger.warn('Unsupported options:', unsupported);
 * }
 */
export function detectUnsupportedOptions(
  executor: ExecutorType,
  options: CommonExecutorOptions,
): string[] {
  const capabilities = EXECUTOR_CAPABILITIES[executor];
  const warnings: string[] = [];

  if (options.maxTurns !== undefined && !capabilities.maxTurnsLimit) {
    warnings.push("maxTurns");
  }

  if (
    (options.allowedTools !== undefined || options.disallowedTools !== undefined) &&
    !capabilities.toolFiltering
  ) {
    warnings.push("allowedTools/disallowedTools");
  }

  if (options.systemPrompt !== undefined && !capabilities.customSystemPrompt) {
    warnings.push("systemPrompt");
  }

  if (options.outputFormat !== undefined && !capabilities.outputFormatting) {
    warnings.push("outputFormat");
  }

  if (options.verbose !== undefined && !capabilities.verboseMode) {
    warnings.push("verbose");
  }

  if (options.continueSession !== undefined && !capabilities.sessionContinuation) {
    warnings.push("continueSession");
  }

  return warnings;
}

/**
 * Executor機能比較表をMarkdownで生成
 *
 * @returns Markdown形式の機能比較表
 */
export function generateCapabilityMatrix(): string {
  const executors = ALL_EXECUTOR_TYPES;
  const features: Array<{ key: keyof ExecutorCapabilities; label: string; category: string }> = [
    { key: "sessionContinuation", label: "セッション継続", category: "セッション管理" },
    { key: "sessionResume", label: "セッションID再開", category: "セッション管理" },
    { key: "crossRepositorySession", label: "リポジトリ跨ぎ", category: "セッション管理" },
    { key: "maxTurnsLimit", label: "最大ターン数制限", category: "ターン制御" },
    { key: "toolFiltering", label: "ツール許可/禁止", category: "ツール制御" },
    { key: "permissionModes", label: "権限モード", category: "権限制御" },
    { key: "customSystemPrompt", label: "システムプロンプト", category: "プロンプト制御" },
    { key: "outputFormatting", label: "出力フォーマット", category: "出力制御" },
    { key: "verboseMode", label: "詳細ログ", category: "出力制御" },
    { key: "sandboxControl", label: "サンドボックスモード", category: "サンドボックス" },
    { key: "modelSelection", label: "モデル選択", category: "その他" },
    { key: "webSearch", label: "Web検索", category: "その他" },
  ];

  let markdown = "# Executor 機能比較表\n\n";
  markdown += "| 機能 | " + executors.join(" | ") + " |\n";
  markdown += "|------|" + executors.map(() => "------").join("|") + "|\n";

  let currentCategory = "";
  for (const feature of features) {
    if (feature.category !== currentCategory) {
      currentCategory = feature.category;
      markdown += `| **${currentCategory}** | ${executors.map(() => "").join(" | ")} |\n`;
    }

    const row = [feature.label];
    for (const executor of executors) {
      const supported = EXECUTOR_CAPABILITIES[executor][feature.key];
      row.push(supported ? "✅" : "❌");
    }
    markdown += "| " + row.join(" | ") + " |\n";
  }

  markdown += "\n凡例:\n";
  markdown += "- ✅ : サポート\n";
  markdown += "- ❌ : 未サポート\n";

  return markdown;
}

export interface CodexAgentOptions extends CommonExecutorOptions {
  /** 必須: ファイル操作を有効化するため workspace-write を推奨 */
  sandboxMode: "read-only" | "workspace-write" | "danger-full-access";

  /** Git リポジトリチェックをスキップ */
  skipGitRepoCheck?: boolean;

  /** モデル指定 */
  model?: string;

  // ⚠️ 以下のパラメータは CommonExecutorOptions から継承されているが、
  // Codex SDK では未サポートのため実行時に無視されます
  // 詳細は docs/codex-parameter-limitations.md を参照

  /**
   * @deprecated Codex SDK では未サポート - 無視されます
   * @see EXECUTOR_CAPABILITIES.codex.maxTurnsLimit
   */
  maxTurns?: number;

  /**
   * @deprecated Codex SDK では未サポート - 無視されます
   * @see EXECUTOR_CAPABILITIES.codex.toolFiltering
   */
  allowedTools?: string[];

  /**
   * @deprecated Codex SDK では未サポート - 無視されます
   * @see EXECUTOR_CAPABILITIES.codex.toolFiltering
   */
  disallowedTools?: string[];

  /**
   * @deprecated Codex SDK では未サポート - 無視されます
   * @see EXECUTOR_CAPABILITIES.codex.customSystemPrompt
   */
  systemPrompt?: string;

  /**
   * @deprecated Codex SDK では未サポート - resumeSession を使用してください
   * @see EXECUTOR_CAPABILITIES.codex.sessionContinuation
   */
  continueSession?: boolean;

  /**
   * セッション再開用のスレッドID
   * codex.resumeThread(id) で使用されます
   * @see EXECUTOR_CAPABILITIES.codex.sessionResume
   */
  resumeSession?: string;

  /**
   * @deprecated Codex SDK では未サポート - 無視されます
   * @see EXECUTOR_CAPABILITIES.codex.verboseMode
   */
  verbose?: boolean;

  /**
   * @deprecated Codex SDK では未サポート - 無視されます
   * @see EXECUTOR_CAPABILITIES.codex.outputFormatting
   */
  outputFormat?: "text" | "json" | "stream-json";
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
