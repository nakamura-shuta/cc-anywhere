-- LLM比較モード用のテーブル作成

-- 比較タスクテーブル
CREATE TABLE compare_tasks (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  repository_path TEXT NOT NULL,
  base_commit TEXT NOT NULL,
  claude_task_id TEXT,
  codex_task_id TEXT,
  gemini_task_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'partial_success', 'failed', 'cancelling', 'cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- インデックス作成
CREATE INDEX idx_compare_tasks_status ON compare_tasks(status);
CREATE INDEX idx_compare_tasks_repository_id ON compare_tasks(repository_id);
CREATE INDEX idx_compare_tasks_created_at ON compare_tasks(created_at);
CREATE INDEX idx_compare_tasks_completed_at ON compare_tasks(completed_at);
