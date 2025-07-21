#!/bin/bash

# Git Worktree機能の統合テストスクリプト
# 必要最小限のテストスクリプトに統合

set -e

API_KEY="hoge"
BASE_URL="${BASE_URL:-http://localhost:5000}"
REPO_PATH="${REPO_PATH:-$(pwd)}"

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# テスト結果の集計
PASSED=0
FAILED=0

# ヘルパー関数
run_test() {
    local test_name="$1"
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

# 使用方法を表示
usage() {
    echo "使用方法: $0 [オプション]"
    echo ""
    echo "オプション:"
    echo "  all       - すべてのテストを実行（デフォルト）"
    echo "  basic     - 基本機能テストのみ実行"
    echo "  cleanup   - Worktreeのクリーンアップのみ実行"
    echo "  help      - このヘルプを表示"
    echo ""
    echo "環境変数:"
    echo "  BASE_URL  - APIサーバーのURL (デフォルト: http://localhost:5000)"
    echo "  REPO_PATH - リポジトリパス (デフォルト: 現在のディレクトリ)"
}

# クリーンアップ関数
cleanup_worktrees() {
    echo -e "${YELLOW}=== Worktreeクリーンアップ ===${NC}"
    ./scripts/test/cleanup-worktrees.sh
}

# 基本機能テスト
test_basic() {
    echo -e "${BLUE}=== 基本機能テスト ===${NC}"
    
    # シンプルなWorktree作成
    run_test "Worktree作成と実行"
    
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
    
    if [ "$TASK_ID" != "null" ] && [ -n "$TASK_ID" ]; then
        STATUS=$(wait_for_task $TASK_ID)
        if [ "$STATUS" = "completed" ]; then
            pass_test
        else
            fail_test "タスクが失敗しました: $STATUS"
        fi
    else
        fail_test "タスクの作成に失敗しました"
    fi
    
    # keepAfterCompletionテスト
    run_test "keepAfterCompletionオプション"
    
    KEEP_BRANCH="keep/test-$(date +%s)"
    RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d "{
        \"instruction\": \"echo 'Worktree should be kept'\",
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
        sleep 15  # クリーンアップ遅延時間を待つ
        if git worktree list | grep -q "$KEEP_BRANCH"; then
            echo "✓ Worktreeが保持されています"
            pass_test
            # 手動クリーンアップ
            git worktree list | grep "$KEEP_BRANCH" | awk '{print $1}' | xargs git worktree remove --force 2>/dev/null
            git branch -D "$KEEP_BRANCH" 2>/dev/null
        else
            fail_test "Worktreeが保持されませんでした"
        fi
    else
        fail_test "タスクが失敗しました"
    fi
}

# メイン処理
main() {
    local mode="${1:-all}"
    
    case "$mode" in
        help)
            usage
            exit 0
            ;;
        cleanup)
            cleanup_worktrees
            exit 0
            ;;
        basic)
            # 前提条件の確認
            if [ -f ".env" ] && grep -q "ENABLE_WORKTREE=true" .env; then
                echo -e "${GREEN}✓ ENABLE_WORKTREE=true${NC}"
            else
                echo -e "${RED}✗ ENABLE_WORKTREE is not true${NC}"
                exit 1
            fi
            
            cleanup_worktrees > /dev/null 2>&1
            test_basic
            ;;
        all|*)
            # 前提条件の確認
            if [ -f ".env" ] && grep -q "ENABLE_WORKTREE=true" .env; then
                echo -e "${GREEN}✓ ENABLE_WORKTREE=true${NC}"
            else
                echo -e "${RED}✗ ENABLE_WORKTREE is not true${NC}"
                exit 1
            fi
            
            cleanup_worktrees > /dev/null 2>&1
            test_basic
            ;;
    esac
    
    # テスト結果サマリー
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
}

# スクリプトを実行
main "$@"