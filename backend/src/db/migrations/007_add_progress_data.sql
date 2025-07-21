-- Add progress_data column to store task execution progress
ALTER TABLE tasks ADD COLUMN progress_data TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_progress_data ON tasks(id) WHERE progress_data IS NOT NULL;