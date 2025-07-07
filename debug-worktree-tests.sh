#!/bin/bash

# 失敗したテストの詳細デバッグスクリプト

API_KEY="hoge"
BASE_URL="http://localhost:5000"
REPO_PATH="/Users/nakamura.shuta/dev/cc-anywhere"

echo "=== Worktreeテスト デバッグ ==="

# 1. シンプルなWorktree作成の詳細確認
echo -e "\n1. シンプルなWorktree作成の詳細確認"
echo "-----------------------------------"

RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "instruction": "pwd && git branch --show-current && echo \"Worktree test successful\"",
    "context": {
      "workingDirectory": "'$REPO_PATH'"
    },
    "options": {
      "useWorktree": true
    }
  }')

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

# 少し待ってから結果を取得
sleep 5

# 詳細な結果を表示
echo -e "\n完全なレスポンス:"
FULL_RESPONSE=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
echo $FULL_RESPONSE | jq '.'

# resultフィールドの内容を文字列として取得
echo -e "\n結果の内容:"
echo $FULL_RESPONSE | jq -r '.result' | jq -r 'to_entries | map(.value) | join("")' 2>/dev/null || echo $FULL_RESPONSE | jq -r '.result'

# 3. ファイル作成テストの詳細
echo -e "\n\n3. ファイル作成テストの詳細"
echo "----------------------------"

TEST_FILE="worktree-test-debug.txt"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"echo 'test content' > $TEST_FILE && ls -la $TEST_FILE && cat $TEST_FILE\",
    \"context\": {
      \"workingDirectory\": \"$REPO_PATH\"
    },
    \"options\": {
      \"useWorktree\": true
    }
  }")

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

sleep 5

FULL_RESPONSE=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
echo -e "\nステータス: $(echo $FULL_RESPONSE | jq -r '.status')"
echo -e "エラー: $(echo $FULL_RESPONSE | jq '.error')"
echo -e "結果:"
echo $FULL_RESPONSE | jq -r '.result' | jq -r 'to_entries | map(.value) | join("")' 2>/dev/null || echo $FULL_RESPONSE | jq -r '.result'

# 5. keepAfterCompletionテストの詳細
echo -e "\n\n5. keepAfterCompletionテストの詳細"
echo "-----------------------------------"

KEEP_BRANCH="keep/debug-test"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"echo 'Keep this worktree' && pwd\",
    \"context\": {
      \"workingDirectory\": \"$REPO_PATH\"
    },
    \"options\": {
      \"worktree\": {
        \"enabled\": true,
        \"keepAfterCompletion\": true,
        \"branchName\": \"$KEEP_BRANCH\"
      }
    }
  }")

echo "リクエスト送信結果:"
echo $RESPONSE | jq '.'

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
if [ "$TASK_ID" = "null" ]; then
    echo "エラー: タスクIDが取得できませんでした"
else
    echo "Task ID: $TASK_ID"
    sleep 5
    
    FULL_RESPONSE=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
    echo -e "\nタスク結果:"
    echo $FULL_RESPONSE | jq '.'
fi

# Worktreeの状態確認
echo -e "\n\n現在のWorktree状態"
echo "-------------------"
git worktree list | grep cc-anywhere || echo "cc-anywhere関連のWorktreeなし"

echo -e "\n現在のブランチ"
echo "--------------"
git branch | grep cc-anywhere | head -10