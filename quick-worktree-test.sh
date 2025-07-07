#!/bin/bash

API_KEY="hoge"
BASE_URL="http://localhost:5000"
REPO_PATH="/Users/nakamura.shuta/dev/cc-anywhere"

echo "=== Quick Worktree Test ==="

# 1. シンプルなテスト
echo -e "\n1. シンプルなWorktreeテスト"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "instruction": "echo \"Test OK\"",
    "context": {"workingDirectory": "'$REPO_PATH'"},
    "options": {"useWorktree": true}
  }')

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

sleep 5

# 結果を取得して整形
RESULT=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")

echo -e "\nステータス: $(echo $RESULT | jq -r '.status')"
echo -e "結果タイプ: $(echo $RESULT | jq -r '.result | type')"

# 結果が文字列の場合
if [ "$(echo $RESULT | jq -r '.result | type')" = "string" ]; then
    echo -e "結果（文字列）:"
    echo $RESULT | jq -r '.result'
else
    # 結果がオブジェクトの場合（文字配列）
    echo -e "結果（配列を結合）:"
    echo $RESULT | jq -r '.result | to_entries | map(.value) | join("")'
fi

# 2. keepAfterCompletionテスト
echo -e "\n\n2. keepAfterCompletionテスト"
KEEP_BRANCH="keep/quick-test"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "instruction": "echo \"Keep me\"",
    "context": {"workingDirectory": "'$REPO_PATH'"},
    "options": {
      "worktree": {
        "enabled": true,
        "keepAfterCompletion": true,
        "branchName": "'$KEEP_BRANCH'"
      }
    }
  }')

if echo $RESPONSE | jq -e '.taskId' > /dev/null; then
    TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
    echo "Task ID: $TASK_ID"
    
    sleep 5
    
    # 15秒後にWorktreeが残っているか確認
    echo "15秒待機中..."
    sleep 15
    
    if git worktree list | grep -q "$KEEP_BRANCH"; then
        echo "✅ Worktreeが保持されています"
        git worktree list | grep "$KEEP_BRANCH"
    else
        echo "❌ Worktreeが保持されていません"
    fi
else
    echo "エラーレスポンス:"
    echo $RESPONSE | jq '.'
fi

echo -e "\n=== テスト完了 ==="