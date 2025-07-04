#!/bin/bash

# バッチタスクのテストスクリプト

API_URL="http://localhost:5000"
API_KEY="hoge"

echo "Creating batch tasks..."

# バッチタスクを作成
RESPONSE=$(curl -s -X POST "$API_URL/api/batch/tasks" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "echo \"Hello from repository\"",
    "repositories": [
      {
        "name": "cc-anywhere",
        "path": "'"$PWD"'"
      },
      {
        "name": "test-repo-1",
        "path": "/tmp"
      },
      {
        "name": "test-repo-2", 
        "path": "/Users"
      }
    ],
    "options": {
      "timeout": 30000
    }
  }')

echo "Response: $RESPONSE"

# groupIdを抽出
GROUP_ID=$(echo "$RESPONSE" | grep -o '"groupId":"[^"]*' | cut -d'"' -f4)

if [ -z "$GROUP_ID" ]; then
  echo "Failed to create batch tasks"
  exit 1
fi

echo "Created batch with group ID: $GROUP_ID"

# 3秒待つ
sleep 3

echo "Checking batch status..."

# ステータスを確認
curl -s -X GET "$API_URL/api/batch/tasks/$GROUP_ID/status" \
  -H "X-API-Key: $API_KEY" | jq '.'