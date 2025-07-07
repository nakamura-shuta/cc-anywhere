#!/bin/bash

# Git Worktree機能の動作確認用cURLコマンド集
# 
# 前提条件:
# 1. .envファイルでENABLE_WORKTREE=trueに設定
# 2. サーバーを起動: npm run dev
# 3. API_KEYを環境変数に設定: export API_KEY=your-api-key

API_KEY="${API_KEY:-test-api-key}"
BASE_URL="http://localhost:5000"

echo "=== Git Worktree機能の動作確認 ==="
echo ""

# 1. 基本的なWorktreeタスク
echo "1. 基本的なWorktreeタスクの実行"
echo "----------------------------------------"
curl -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "instruction": "pwd && ls -la && git branch --show-current",
    "context": {
      "workingDirectory": "'$(pwd)'"
    },
    "options": {
      "useWorktree": true
    }
  }' | jq .

echo ""
echo "2. Worktreeで変更を加えるタスク"
echo "----------------------------------------"
curl -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "instruction": "echo \"Test from worktree\" > worktree-test.txt && git add worktree-test.txt && git status",
    "context": {
      "workingDirectory": "'$(pwd)'"
    },
    "options": {
      "useWorktree": true
    }
  }' | jq .

echo ""
echo "3. カスタムブランチ名でWorktreeを作成"
echo "----------------------------------------"
curl -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "instruction": "git branch --show-current && echo \"Custom branch test\" > custom-branch.txt",
    "context": {
      "workingDirectory": "'$(pwd)'"
    },
    "options": {
      "worktree": {
        "enabled": true,
        "baseBranch": "main",
        "branchName": "feature/custom-worktree-test",
        "keepAfterCompletion": false
      }
    }
  }' | jq .

echo ""
echo "4. Worktreeを保持するタスク（手動クリーンアップが必要）"
echo "----------------------------------------"
curl -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "instruction": "echo \"This worktree will be kept\" > keep-worktree.txt && pwd",
    "context": {
      "workingDirectory": "'$(pwd)'"
    },
    "options": {
      "worktree": {
        "enabled": true,
        "keepAfterCompletion": true,
        "branchName": "feature/kept-worktree"
      }
    }
  }' | jq .

echo ""
echo "5. タスクの状態確認（最後のタスクIDを使用）"
echo "----------------------------------------"
echo "タスクIDを指定して実行: curl -H \"X-API-Key: ${API_KEY}\" \"${BASE_URL}/api/tasks/{taskId}\""

echo ""
echo "=== 確認コマンド ==="
echo "----------------------------------------"
echo "# 現在のWorktreeを確認"
echo "git worktree list"
echo ""
echo "# Worktreeのディレクトリを確認"
echo "ls -la .worktrees/"
echo ""
echo "# 特定のWorktreeに移動"
echo "cd .worktrees/cc-anywhere-*"
echo ""
echo "# Worktreeを手動で削除"
echo "git worktree remove .worktrees/cc-anywhere-*"
echo ""
echo "# 全てのWorktreeをクリーンアップ"
echo "git worktree prune"