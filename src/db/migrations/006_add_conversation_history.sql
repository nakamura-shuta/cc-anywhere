-- Add conversation_history column to tasks table
ALTER TABLE tasks ADD COLUMN conversation_history TEXT;

-- Add index for tasks with conversation history
CREATE INDEX IF NOT EXISTS idx_tasks_has_conversation ON tasks(id) WHERE conversation_history IS NOT NULL;