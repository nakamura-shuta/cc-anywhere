-- セッション機能のためのマイグレーション
-- Migration: 002_add_sessions
-- Created: 2025-01-15

-- セッションテーブル
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'expired')),
  context TEXT, -- JSON object containing session context
  metadata TEXT, -- JSON object for additional metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- 会話履歴テーブル
CREATE TABLE IF NOT EXISTS conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  response TEXT,
  metadata TEXT, -- JSON object containing turn metadata (tool usage, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- タスクテーブルにsession_idカラムを追加
ALTER TABLE tasks ADD COLUMN session_id TEXT REFERENCES sessions(id);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversation_turns_session_id ON conversation_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);

-- セッションのupdated_atを自動更新するトリガー
CREATE TRIGGER IF NOT EXISTS update_sessions_updated_at 
  AFTER UPDATE ON sessions
BEGIN
  UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 期限切れセッションを自動的に更新するビュー（参照用）
CREATE VIEW IF NOT EXISTS active_sessions AS
SELECT * FROM sessions 
WHERE status = 'active' 
  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);