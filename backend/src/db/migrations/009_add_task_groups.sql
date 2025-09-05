-- Task Groups table
CREATE TABLE IF NOT EXISTS task_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  execution_mode TEXT NOT NULL CHECK(execution_mode IN ('sequential', 'parallel', 'mixed')),
  max_parallel INTEGER,
  session_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error TEXT,
  progress_completed INTEGER DEFAULT 0,
  progress_total INTEGER NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  current_task TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Task Group Tasks table
CREATE TABLE IF NOT EXISTS task_group_tasks (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  instruction TEXT NOT NULL,
  dependencies TEXT, -- JSON array of task IDs
  context TEXT, -- JSON object
  options TEXT, -- JSON object
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result TEXT, -- JSON object
  error TEXT,
  execution_order INTEGER,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES task_groups(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_groups_status ON task_groups(status);
CREATE INDEX IF NOT EXISTS idx_task_groups_session_id ON task_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_started_at ON task_groups(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_groups_updated_at ON task_groups(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_group_tasks_group_id ON task_group_tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_task_group_tasks_status ON task_group_tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_group_tasks_execution_order ON task_group_tasks(group_id, execution_order);

-- Triggers to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_task_groups_updated_at 
  AFTER UPDATE ON task_groups
BEGIN
  UPDATE task_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_task_group_tasks_updated_at 
  AFTER UPDATE ON task_group_tasks
BEGIN
  UPDATE task_group_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;