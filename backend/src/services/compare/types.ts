/**
 * LLM比較モード関連の型定義
 */

import type { CompareTaskStatus } from "../../repositories/types.js";

/**
 * 比較タスク作成リクエスト
 */
export interface CreateCompareTaskRequest {
  instruction: string;
  repositoryId: string;
}

/**
 * 比較タスク作成レスポンス
 */
export interface CreateCompareTaskResponse {
  compareId: string;
  claudeTaskId: string;
  codexTaskId: string;
  geminiTaskId: string;
  status: CompareTaskStatus;
}

/**
 * 比較タスク詳細レスポンス
 */
export interface CompareTaskDetailResponse {
  compareId: string;
  instruction: string;
  repositoryId: string;
  baseCommit: string;
  status: CompareTaskStatus;
  claudeTaskId: string | null;
  codexTaskId: string | null;
  geminiTaskId: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * ファイル変更ステータス
 */
export type FileChangeStatus = "A" | "M" | "D" | null;

/**
 * 比較ファイル情報
 */
export interface CompareFileInfo {
  path: string;
  claude: FileChangeStatus;
  codex: FileChangeStatus;
  gemini: FileChangeStatus;
}

/**
 * 変更ファイル一覧レスポンス
 */
export interface CompareFilesResponse {
  files: CompareFileInfo[];
  truncated: boolean;
  totalCount: number;
}

/**
 * Worktree情報（比較モード用）
 */
export interface CompareWorktreeInfo {
  executor: "claude" | "codex" | "gemini";
  worktreePath: string;
  branchName: string;
}

/**
 * 比較モード設定
 */
export interface CompareConfig {
  /** worktreeベースパス */
  worktreeBasePath: string;
  /** worktree保持期間（時間） */
  worktreeRetentionHours: number;
  /** 最大同時実行比較タスク数 */
  maxConcurrentCompareTasks: number;
  /** 最小ディスク空き容量（GB） */
  minFreeSpaceGB: number;
  /** 変更ファイル最大取得数 */
  maxFilesCount: number;
}

/**
 * 比較モードエラーコード
 */
export const CompareErrorCode = {
  REPOSITORY_NOT_FOUND: "REPOSITORY_NOT_FOUND",
  REPOSITORY_PATH_NOT_EXISTS: "REPOSITORY_PATH_NOT_EXISTS",
  NOT_A_GIT_REPOSITORY: "NOT_A_GIT_REPOSITORY",
  TOO_MANY_COMPARE_TASKS: "TOO_MANY_COMPARE_TASKS",
  INSUFFICIENT_DISK_SPACE: "INSUFFICIENT_DISK_SPACE",
  WORKTREE_CREATION_FAILED: "WORKTREE_CREATION_FAILED",
  COMPARE_TASK_NOT_FOUND: "COMPARE_TASK_NOT_FOUND",
  CANCEL_FAILED: "CANCEL_FAILED",
} as const;

export type CompareErrorCodeType = (typeof CompareErrorCode)[keyof typeof CompareErrorCode];
