/**
 * Unified session types
 */

export type SessionType = "task" | "chat";
export type SessionStatus = "active" | "paused" | "completed" | "expired";
export type SessionState = "idle" | "running" | "requires_action";
export type ExecutorType = "claude" | "codex" | "gemini";
export type MessageRole = "user" | "agent" | "system";

export interface Session {
  id: string;
  userId?: string;
  sessionType: SessionType;
  status: SessionStatus;
  executor: ExecutorType;
  characterId?: string;
  workingDirectory?: string;
  sdkSessionId?: string;
  sdkSessionState?: SessionState;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  turnNumber?: number;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateSessionParams {
  type: SessionType;
  userId?: string;
  characterId?: string;
  workingDirectory?: string;
  executor?: ExecutorType;
  sdkSessionId?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  expiresIn?: number;
}

export interface AddMessageParams {
  sessionId: string;
  role: MessageRole;
  content: string;
  turnNumber?: number;
  metadata?: Record<string, unknown>;
}
