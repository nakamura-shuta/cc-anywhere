#!/bin/bash

# バッチタスクをデータベースから確認

DB_PATH="./data/cc-anywhere.db"

echo "=== バッチタスク（グループ別）==="
sqlite3 "$DB_PATH" "
SELECT 
  group_id,
  COUNT(*) as task_count,
  GROUP_CONCAT(repository_name, ', ') as repositories,
  GROUP_CONCAT(status, ', ') as statuses
FROM tasks
WHERE group_id IS NOT NULL
GROUP BY group_id
ORDER BY created_at DESC;"

echo -e "\n=== 最新のバッチタスク詳細 ==="
sqlite3 "$DB_PATH" "
SELECT 
  id,
  repository_name,
  status,
  instruction,
  created_at
FROM tasks
WHERE group_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;"