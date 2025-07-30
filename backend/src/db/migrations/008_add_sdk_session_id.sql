-- Claude Code SDKのセッションID管理用カラムを追加
-- タスク実行時にSDKから返されるセッションIDを保存し、
-- continue機能で会話を継続できるようにする

ALTER TABLE tasks ADD COLUMN sdk_session_id TEXT;

-- インデックスを追加（セッションIDでの検索を高速化）
CREATE INDEX idx_tasks_sdk_session_id ON tasks(sdk_session_id);

-- 既存のタスクはNULLのまま
-- 新しいタスクから順次セッションIDが保存される