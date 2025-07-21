/**
 * セッション関連の型定義
 */

/**
 * セッションのステータス
 */
export type SessionStatus = "active" | "paused" | "completed" | "expired";

/**
 * セッションエンティティ
 */
export interface Session {
  id: string;
  userId?: string;
  status: SessionStatus;
  context?: SessionContext;
  metadata?: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * セッションコンテキスト
 * セッション全体で共有される情報
 */
export interface SessionContext {
  workingDirectory?: string;
  environment?: Record<string, string>;
  systemPrompt?: string;
  defaultOptions?: {
    permissionMode?: string;
    maxTurns?: number;
    allowedTools?: string[];
  };
}

/**
 * セッションメタデータ
 */
export interface SessionMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  totalTurns?: number;
  lastActivityAt?: Date;
}

/**
 * 会話ターン
 */
export interface ConversationTurn {
  id?: number;
  sessionId: string;
  turnNumber: number;
  instruction: string;
  response?: string;
  metadata?: TurnMetadata;
  createdAt: Date;
}

/**
 * ターンメタデータ
 */
export interface TurnMetadata {
  taskId?: string;
  duration?: number;
  toolsUsed?: string[];
  filesModified?: string[];
  error?: any;
}

/**
 * セッション作成リクエスト
 */
export interface CreateSessionRequest {
  userId?: string;
  context?: SessionContext;
  metadata?: SessionMetadata;
  expiresIn?: number; // 有効期限（秒）
}

/**
 * セッション作成レスポンス
 */
export interface CreateSessionResponse {
  session: Session;
}

/**
 * セッション継続リクエスト
 */
export interface ContinueSessionRequest {
  sessionId: string;
  instruction: string;
  options?: {
    timeout?: number;
    permissionMode?: string;
    allowedTools?: string[];
    // その他のタスクオプション
  };
}

/**
 * セッション継続レスポンス
 */
export interface ContinueSessionResponse {
  turnNumber: number;
  taskId: string;
  result?: any;
  error?: any;
}

/**
 * セッション履歴リクエスト
 */
export interface GetSessionHistoryRequest {
  sessionId: string;
  limit?: number;
  offset?: number;
}

/**
 * セッション履歴レスポンス
 */
export interface GetSessionHistoryResponse {
  sessionId: string;
  turns: ConversationTurn[];
  totalTurns: number;
  hasMore: boolean;
}

/**
 * セッション一覧リクエスト
 */
export interface ListSessionsRequest {
  userId?: string;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

/**
 * セッション一覧レスポンス
 */
export interface ListSessionsResponse {
  sessions: Session[];
  total: number;
  hasMore: boolean;
}
