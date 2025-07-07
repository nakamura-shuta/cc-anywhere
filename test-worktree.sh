#!/bin/bash

# CC-Anywhere Git Worktree テストスクリプト

API_KEY="hoge"
BASE_URL="http://localhost:5000"
REPO_PATH="/Users/nakamura.shuta/dev/cc-anywhere"

echo "=== Git Worktree 機能テスト ==="
echo ""

# 1. 基本的なWorktree作成テスト
echo "1. 基本的なWorktree作成テスト"
echo "-------------------------------"

RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"pwd && echo '---' && git branch --show-current && echo '---' && ls -la\",
    \"context\": {
      \"workingDirectory\": \"$REPO_PATH\"
    },
    \"options\": {
      \"useWorktree\": true
    }
  }")

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

# タスクが完了するまで待機
echo "タスク実行中..."
sleep 3

# 結果を取得
echo ""
echo "実行結果:"
RESULT=$(curl -s $BASE_URL/api/tasks/$TASK_ID -H "X-API-Key: $API_KEY")

# 結果を整形して表示
echo $RESULT | jq -r '.result' | jq -r 'to_entries | map(.value) | join("")' 2>/dev/null || echo $RESULT | jq '.result'

echo ""
echo "2. 現在のWorktree状態"
echo "---------------------"
git worktree list | grep cc-anywhere || echo "No worktrees found"

echo ""
echo "3. 作成されたブランチ"
echo "-------------------"
git branch | grep cc-anywhere | head -5

echo ""
echo "=== テスト完了 ==="