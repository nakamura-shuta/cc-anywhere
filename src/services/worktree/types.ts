/**
 * Git Worktree関連の型定義
 */

/**
 * Worktreeオプション（タスク実行時に指定）
 */
export interface WorktreeOptions {
  /** Worktree機能を有効にするか */
  enabled: boolean;
  /** ベースブランチ（デフォルト: 現在のブランチ） */
  baseBranch?: string;
  /** 作成するブランチ名（デフォルト: 自動生成） */
  branchName?: string;
  /** タスク完了後もworktreeを保持するか */
  keepAfterCompletion?: boolean;
  /** 自動コミットを行うか */
  autoCommit?: boolean;
  /** コミットメッセージのテンプレート */
  commitMessage?: string;
  /** 自動マージを行うか */
  autoMerge?: boolean;
  /** マージ戦略 */
  mergeStrategy?: "merge" | "rebase" | "squash";
  /** マージ先のブランチ */
  targetBranch?: string;
}

/**
 * Worktree情報
 */
export interface Worktree {
  /** WorktreeのID */
  id: string;
  /** 関連するタスクID */
  taskId: string;
  /** Worktreeのパス */
  path: string;
  /** ブランチ名 */
  branch: string;
  /** ベースブランチ名 */
  baseBranch: string;
  /** リポジトリパス */
  repository: string;
  /** 作成日時 */
  createdAt: Date;
  /** 状態 */
  status: "active" | "completed" | "failed" | "cleanup_required";
  /** エラー情報 */
  error?: string;
}

/**
 * Worktree設定
 */
export interface WorktreeConfig {
  /** 最大同時worktree数 */
  maxWorktrees: number;
  /** Worktreeベースディレクトリ */
  baseDirectory: string;
  /** 自動クリーンアップを有効にするか */
  autoCleanup: boolean;
  /** クリーンアップ遅延時間（ミリ秒） */
  cleanupDelay: number;
  /** worktree名のプレフィックス */
  worktreePrefix: string;
}

/**
 * Git操作の結果
 */
export interface GitOperationResult {
  /** 成功したか */
  success: boolean;
  /** 出力 */
  output?: string;
  /** エラー */
  error?: string;
}

/**
 * Gitステータス情報
 */
export interface GitStatus {
  /** 現在のブランチ */
  current: string;
  /** 変更されたファイル */
  files: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed";
  }>;
  /** リモートとの差分 */
  ahead: number;
  behind: number;
}

/**
 * Worktree作成オプション
 */
export interface CreateWorktreeOptions {
  /** タスクID */
  taskId: string;
  /** リポジトリパス */
  repositoryPath: string;
  /** ベースブランチ */
  baseBranch: string;
  /** ブランチ名（オプション） */
  branchName?: string;
}

/**
 * Worktreeクリーンアップオプション
 */
export interface CleanupOptions {
  /** 強制削除するか */
  force?: boolean;
  /** 未コミットの変更を保存するか */
  saveUncommitted?: boolean;
  /** バックアップディレクトリ */
  backupPath?: string;
}

/**
 * Worktreeヘルスチェック結果
 */
export interface WorktreeHealthCheckResult {
  /** チェック名 */
  name: string;
  /** 成功したか */
  passed: boolean;
  /** 詳細情報 */
  details: Record<string, any>;
  /** 推奨アクション */
  recommendations?: string[];
}

/**
 * Worktreeメタデータ（永続化用）
 */
export interface WorktreeMetadata {
  /** Worktree一覧 */
  worktrees: Worktree[];
  /** 最終更新日時 */
  lastUpdated: Date;
  /** バージョン */
  version: string;
}

/**
 * Worktreeログエントリ
 */
export interface WorktreeLogEntry {
  /** タイムスタンプ */
  timestamp: Date;
  /** ログレベル */
  level: "debug" | "info" | "warn" | "error" | "critical";
  /** 操作名 */
  operation: string;
  /** タスクID */
  taskId?: string;
  /** WorktreeID */
  worktreeId?: string;
  /** メッセージ */
  message: string;
  /** 詳細情報 */
  details?: Record<string, any>;
  /** スタックトレース */
  stackTrace?: string;
}

/**
 * Worktreeエラー
 */
export class WorktreeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "WorktreeError";
  }

  toString(): string {
    return this.message;
  }
}

/**
 * Worktreeエラーコード
 */
export const WorktreeErrorCode = {
  CREATION_FAILED: "WORKTREE_CREATION_FAILED",
  DELETION_FAILED: "WORKTREE_DELETION_FAILED",
  BRANCH_CONFLICT: "WORKTREE_BRANCH_CONFLICT",
  DISK_SPACE: "WORKTREE_DISK_SPACE",
  PERMISSION_DENIED: "WORKTREE_PERMISSION_DENIED",
  CORRUPTION_DETECTED: "WORKTREE_CORRUPTION_DETECTED",
  CLEANUP_FAILED: "WORKTREE_CLEANUP_FAILED",
  NOT_GIT_REPOSITORY: "WORKTREE_NOT_GIT_REPOSITORY",
  MAX_WORKTREES_EXCEEDED: "WORKTREE_MAX_EXCEEDED",
  INVALID_CONFIG: "WORKTREE_INVALID_CONFIG",
} as const;

export type WorktreeErrorCodeType = (typeof WorktreeErrorCode)[keyof typeof WorktreeErrorCode];
