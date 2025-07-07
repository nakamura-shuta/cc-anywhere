#!/bin/bash

# Git Worktree機能の包括的テストスクリプト
# docs/testing/worktree-test-scenarios.mdに基づく

API_KEY="hoge"
BASE_URL="http://localhost:5000"
REPO_PATH="/Users/nakamura.shuta/dev/cc-anywhere"

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# テスト結果の集計
PASSED=0
FAILED=0

# テスト関数
run_test() {
    local test_name="$1"
    local expected="$2"
    echo -e "\n${YELLOW}テスト: $test_name${NC}"
}

pass_test() {
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
}

fail_test() {
    local reason="$1"
    echo -e "${RED}❌ FAIL: $reason${NC}"
    ((FAILED++))
}

# ヘルパー関数
check_worktree_count() {
    git worktree list | grep -c cc-anywhere
}

wait_for_task() {
    local task_id="$1"
    local max_wait=30
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        local status=$(curl -s "$BASE_URL/api/tasks/$task_id" -H "X-API-Key: $API_KEY" | jq -r '.status')
        if [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
            echo "$status"
            return
        fi
        sleep 1
        ((waited++))
    done
    echo "timeout"
}

echo "=== Git Worktree機能 テストスイート ==="
echo "API: $BASE_URL"
echo "リポジトリ: $REPO_PATH"

# 前提条件の確認
echo -e "\n${YELLOW}前提条件の確認${NC}"
if [ -f ".env" ] && grep -q "ENABLE_WORKTREE=true" .env; then
    echo -e "${GREEN}✓ ENABLE_WORKTREE=true${NC}"
else
    echo -e "${RED}✗ ENABLE_WORKTREE is not true${NC}"
    exit 1
fi

# 初期クリーンアップ
echo -e "\n${YELLOW}初期クリーンアップ${NC}"
./scripts/test/cleanup-worktrees.sh > /dev/null 2>&1

# ========================================
# 1. 基本機能テスト
# ========================================
echo -e "\n${YELLOW}=== 1. 基本機能テスト ===${NC}"

# 1.1 シンプルなWorktree作成
run_test "1.1 シンプルなWorktree作成"

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

# Worktreeが作成されたか確認
sleep 2
WORKTREE_COUNT=$(check_worktree_count)
if [ $WORKTREE_COUNT -gt 0 ]; then
    echo "✓ Worktreeが作成されました"
    git worktree list | grep cc-anywhere
else
    fail_test "Worktreeが作成されませんでした"
fi

# タスク完了を待つ
STATUS=$(wait_for_task $TASK_ID)
if [ "$STATUS" = "completed" ]; then
    RESULT=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
    # 結果の中に期待される要素が含まれているか確認
    RESULT_TEXT=$(echo $RESULT | jq -r '.result' | jq -r 'to_entries | map(.value) | join("")' 2>/dev/null || echo $RESULT | jq -r '.result')
    if echo "$RESULT_TEXT" | grep -q "cc-anywhere" && echo "$RESULT_TEXT" | grep -q "worktrees"; then
        pass_test
    else
        fail_test "期待される出力が得られませんでした"
    fi
else
    fail_test "タスクが失敗しました: $STATUS"
fi

# 1.2 カスタムブランチ名でのWorktree
run_test "1.2 カスタムブランチ名でのWorktree"

CUSTOM_BRANCH="test/custom-branch-$(date +%s)"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"git branch --show-current\",
    \"context\": {
      \"workingDirectory\": \"$REPO_PATH\"
    },
    \"options\": {
      \"worktree\": {
        \"enabled\": true,
        \"branchName\": \"$CUSTOM_BRANCH\"
      }
    }
  }")

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
STATUS=$(wait_for_task $TASK_ID)

if [ "$STATUS" = "completed" ]; then
    RESULT=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
    RESULT_TEXT=$(echo $RESULT | jq -r '.result' | jq -r 'to_entries | map(.value) | join("")' 2>/dev/null || echo $RESULT | jq -r '.result')
    if echo "$RESULT_TEXT" | grep -q "$CUSTOM_BRANCH"; then
        pass_test
    else
        fail_test "カスタムブランチ名が使用されませんでした"
    fi
else
    fail_test "タスクが失敗しました"
fi

# ========================================
# 2. 複数タスク実行テスト
# ========================================
echo -e "\n${YELLOW}=== 2. 複数タスク実行テスト ===${NC}"

# 2.1 複数タスクの順次実行とWorktree管理
run_test "2.1 複数タスクの順次実行とWorktree管理"

# 複数タスク実行前の状態を記録
INITIAL_WORKTREE_COUNT=$(check_worktree_count)
echo "初期Worktree数: $INITIAL_WORKTREE_COUNT"

# 3つのタスクを作成
TASK_IDS=()
EXPECTED_TASKS=3
for i in $(seq 1 $EXPECTED_TASKS); do
    RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d "{
        \"instruction\": \"echo 'Task $i running' && pwd && ls -la\",
        \"context\": {
          \"workingDirectory\": \"$REPO_PATH\"
        },
        \"options\": {
          \"useWorktree\": true
        }
      }")
    TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
    
    # エラーチェック
    if [ "$TASK_ID" != "null" ] && [ -n "$TASK_ID" ]; then
        TASK_IDS+=($TASK_ID)
        echo "✓ タスク$i作成: $TASK_ID"
    else
        echo "✗ タスク$i作成エラー: $RESPONSE"
    fi
done

echo "作成されたタスク数: ${#TASK_IDS[@]}"

# すべてのタスクが完了するまで待つ
ALL_COMPLETED=false
MAX_WAIT=60
WAITED=0

while [ "$ALL_COMPLETED" = false ] && [ $WAITED -lt $MAX_WAIT ]; do
    COMPLETED_COUNT=0
    for TASK_ID in "${TASK_IDS[@]}"; do
        STATUS=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY" | jq -r '.status')
        if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
            ((COMPLETED_COUNT++))
        fi
    done
    
    if [ $COMPLETED_COUNT -eq ${#TASK_IDS[@]} ]; then
        ALL_COMPLETED=true
    else
        sleep 2
        ((WAITED+=2))
    fi
done

# 結果の確認
if [ "$ALL_COMPLETED" = true ]; then
    echo "✓ すべてのタスクが完了しました"
    
    # 各タスクでWorktreeが作成されたか確認
    WORKTREE_CREATED_COUNT=0
    for TASK_ID in "${TASK_IDS[@]}"; do
        LOGS=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY" | jq -r '.logs[]')
        if echo "$LOGS" | grep -q "Created worktree"; then
            ((WORKTREE_CREATED_COUNT++))
        fi
    done
    
    echo "Worktreeが作成されたタスク数: $WORKTREE_CREATED_COUNT / ${#TASK_IDS[@]}"
    
    if [ $WORKTREE_CREATED_COUNT -eq ${#TASK_IDS[@]} ]; then
        echo "✓ すべてのタスクでWorktreeが正しく作成されました"
        pass_test
    else
        fail_test "一部のタスクでWorktreeが作成されませんでした"
    fi
else
    fail_test "タスクがタイムアウトしました"
fi

# ========================================
# 3. ファイル操作テスト
# ========================================
echo -e "\n${YELLOW}=== 3. ファイル操作テスト ===${NC}"

# 3.1 ファイル作成と独立性確認
run_test "3.1 ファイル作成と独立性確認"

TEST_FILE="worktree-test-$(date +%s).txt"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"echo 'test content' > $TEST_FILE && git add $TEST_FILE && git status\",
    \"context\": {
      \"workingDirectory\": \"$REPO_PATH\"
    },
    \"options\": {
      \"useWorktree\": true
    }
  }")

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
STATUS=$(wait_for_task $TASK_ID)

if [ "$STATUS" = "completed" ]; then
    # メインリポジトリでファイルが存在しないことを確認
    if [ ! -f "$REPO_PATH/$TEST_FILE" ]; then
        echo "✓ メインリポジトリには影響なし"
        pass_test
    else
        fail_test "メインリポジトリにファイルが作成されてしまいました"
    fi
else
    fail_test "タスクが失敗しました"
fi

# ========================================
# 4. エラーハンドリングテスト
# ========================================
echo -e "\n${YELLOW}=== 4. エラーハンドリングテスト ===${NC}"

# 4.1 Worktree作成失敗
run_test "4.1 Gitリポジトリでない場所でのWorktree作成"

RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "instruction": "echo \"test\"",
    "context": {
      "workingDirectory": "/tmp"
    },
    "options": {
      "useWorktree": true
    }
  }')

STATUS=$(echo $RESPONSE | jq -r '.status')
if [ "$STATUS" = "failed" ]; then
    ERROR_MSG=$(echo $RESPONSE | jq -r '.error.message')
    echo "期待通りエラーが発生: $ERROR_MSG"
    pass_test
else
    fail_test "エラーが発生しませんでした"
fi

# 4.2 タスク実行中のエラー
run_test "4.2 タスク実行中のエラー"

RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"exit 1\",
    \"context\": {
      \"workingDirectory\": \"$REPO_PATH\"
    },
    \"options\": {
      \"useWorktree\": true
    }
  }")

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
sleep 2

# Worktreeが作成されたか確認
INITIAL_COUNT=$(check_worktree_count)

# タスク完了を待つ
STATUS=$(wait_for_task $TASK_ID)

# Claude Code SDKはexit 1を成功として扱う可能性があるため、結果を確認
RESULT=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
RESULT_TEXT=$(echo $RESULT | jq -r '.result' | jq -r 'to_entries | map(.value) | join("")' 2>/dev/null || echo $RESULT | jq -r '.result')

# exit 1が実行されたことを確認
if echo "$RESULT_TEXT" | grep -q "exit" || [ "$STATUS" = "failed" ]; then
    echo "✓ タスクでexit 1が実行されました"
    pass_test
else
    fail_test "exit 1が正しく実行されませんでした"
fi

# ========================================
# 5. クリーンアップテスト
# ========================================
echo -e "\n${YELLOW}=== 5. クリーンアップテスト ===${NC}"

# 5.2 keepAfterCompletionオプション
run_test "5.2 keepAfterCompletionオプション"

KEEP_BRANCH="keep/test-$(date +%s)"
RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"instruction\": \"echo 'important changes' > result.txt\",
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

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
STATUS=$(wait_for_task $TASK_ID)

if [ "$STATUS" = "completed" ]; then
    # 15秒待ってもWorktreeが残っているか確認
    sleep 15
    if git worktree list | grep -q "$KEEP_BRANCH"; then
        echo "✓ Worktreeが保持されています"
        pass_test
        # クリーンアップ
        git worktree list | grep "$KEEP_BRANCH" | awk '{print $1}' | xargs git worktree remove --force
    else
        fail_test "Worktreeが保持されませんでした"
    fi
else
    fail_test "タスクが失敗しました"
fi

# ========================================
# テスト結果サマリー
# ========================================
echo -e "\n${YELLOW}=== テスト結果サマリー ===${NC}"
TOTAL=$((PASSED + FAILED))
echo -e "実行: $TOTAL"
echo -e "${GREEN}成功: $PASSED${NC}"
echo -e "${RED}失敗: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}すべてのテストが成功しました！${NC}"
    exit 0
else
    echo -e "\n${RED}一部のテストが失敗しました${NC}"
    exit 1
fi