-- スケジュール永続化のためのテーブル作成

-- スケジュール設定テーブル
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  task_request TEXT NOT NULL,  -- JSON: TaskRequest
  schedule_type TEXT NOT NULL CHECK(schedule_type IN ('cron', 'once')),
  cron_expression TEXT,
  execute_at DATETIME,
  timezone TEXT DEFAULT 'Asia/Tokyo',
  status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'completed', 'failed')),
  metadata TEXT NOT NULL,      -- JSON: metadata (createdAt, updatedAt, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- スケジュール実行履歴テーブル
CREATE TABLE schedule_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id TEXT NOT NULL,
  executed_at DATETIME NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

-- スケジュールのセッション状態管理テーブル
CREATE TABLE schedule_session_state (
  schedule_id TEXT PRIMARY KEY,
  execution_count INTEGER DEFAULT 0,
  last_session_reset DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_schedule_type ON schedules(schedule_type);
CREATE INDEX idx_schedule_history_schedule_id ON schedule_history(schedule_id);
CREATE INDEX idx_schedule_history_executed_at ON schedule_history(executed_at);
CREATE INDEX idx_schedule_session_state_updated_at ON schedule_session_state(updated_at);