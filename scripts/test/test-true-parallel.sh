#!/bin/bash

# Claude Code SDKの真の並列実行テスト

API_KEY="hoge"
BASE_URL="http://localhost:5000"
REPO_PATH="$(cd "$(dirname "$0")/../.." && pwd)"

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=== Claude Code SDK 並列実行テスト ==="

# 現在の設定を確認
echo -e "\n${YELLOW}現在の設定:${NC}"
echo "QUEUE_CONCURRENCY: $(grep QUEUE_CONCURRENCY "$REPO_PATH/.env" | cut -d= -f2)"
echo "WORKER_MODE: $(grep WORKER_MODE "$REPO_PATH/.env" | cut -d= -f2 || echo 'inline (default)')"

# キューの状態を確認
echo -e "\n${YELLOW}初期のキュー状態:${NC}"
curl -s "$BASE_URL/api/queue/stats" -H "X-API-Key: $API_KEY" | jq .

# クリーンアップ
echo -e "\n${YELLOW}クリーンアップ中...${NC}"
"$REPO_PATH/scripts/test/cleanup-worktrees.sh" > /dev/null 2>&1

# 時間のかかるタスクを3つ同時に作成
echo -e "\n${YELLOW}3つの長時間タスクを作成（各15秒）${NC}"

TASK_IDS=()
START_TIME=$(date +%s)

for i in 1 2 3; do
    echo -e "\n${BLUE}タスク$i を作成中...${NC}"
    
    RESPONSE=$(curl -s -X POST $BASE_URL/api/tasks \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d "{
        \"instruction\": \"echo 'Task $i started at:' && date && sleep 15 && echo 'Task $i finished at:' && date\",
        \"context\": {
          \"workingDirectory\": \"$REPO_PATH\"
        },
        \"options\": {
          \"useWorktree\": true
        }
      }")
    
    TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
    if [ "$TASK_ID" != "null" ] && [ -n "$TASK_ID" ]; then
        TASK_IDS+=($TASK_ID)
        echo -e "${GREEN}✓${NC} タスク$i作成: $TASK_ID"
    fi
done

# タスクのステータスを監視（30秒間）
echo -e "\n${YELLOW}タスクステータスの監視（30秒間）${NC}"
echo -e "${BLUE}時刻\t\tタスク1\t\tタスク2\t\tタスク3\t\t実行中${NC}"

for i in {1..30}; do
    # 各タスクのステータスを取得
    STATUSES=()
    RUNNING=0
    
    for TASK_ID in "${TASK_IDS[@]}"; do
        STATUS=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY" | jq -r '.status')
        STATUSES+=("$STATUS")
        if [ "$STATUS" = "running" ]; then
            ((RUNNING++))
        fi
    done
    
    # ステータスを表示
    TIME=$(date +"%H:%M:%S")
    printf "${TIME}\t${STATUSES[0]}\t${STATUSES[1]}\t${STATUSES[2]}\t$RUNNING\n"
    
    sleep 1
done

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

# 結果の分析
echo -e "\n${YELLOW}=== 結果分析 ===${NC}"
echo "総実行時間: ${TOTAL_TIME}秒"

# 各タスクの詳細を取得
for i in "${!TASK_IDS[@]}"; do
    TASK_ID="${TASK_IDS[$i]}"
    echo -e "\n${BLUE}タスク$((i+1)) ($TASK_ID):${NC}"
    
    DETAILS=$(curl -s "$BASE_URL/api/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
    STATUS=$(echo $DETAILS | jq -r '.status')
    STARTED=$(echo $DETAILS | jq -r '.startedAt')
    COMPLETED=$(echo $DETAILS | jq -r '.completedAt')
    
    echo "状態: $STATUS"
    echo "開始: $STARTED"
    echo "完了: $COMPLETED"
    
    # 実行時間を計算（秒単位）
    if [ "$STARTED" != "null" ] && [ "$COMPLETED" != "null" ]; then
        START_SEC=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${STARTED%%.*}" +%s 2>/dev/null || echo 0)
        END_SEC=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${COMPLETED%%.*}" +%s 2>/dev/null || echo 0)
        if [ $START_SEC -ne 0 ] && [ $END_SEC -ne 0 ]; then
            DURATION=$((END_SEC - START_SEC))
            echo "実行時間: ${DURATION}秒"
        fi
    fi
done

# 並列実行の判定
echo -e "\n${YELLOW}=== 並列実行の判定 ===${NC}"
if [ $TOTAL_TIME -lt 30 ]; then
    echo -e "${GREEN}✅ 並列実行が確認されました！${NC}"
    echo "3つの15秒タスクが${TOTAL_TIME}秒で完了しました。"
elif [ $TOTAL_TIME -lt 45 ]; then
    echo -e "${YELLOW}⚠️ 部分的な並列実行${NC}"
    echo "一部のタスクが並列実行されています。"
else
    echo -e "${RED}❌ 順次実行されています${NC}"
    echo "タスクが順番に実行されているようです。"
fi

# 最終的なキューの状態
echo -e "\n${YELLOW}最終的なキュー状態:${NC}"
curl -s "$BASE_URL/api/queue/stats" -H "X-API-Key: $API_KEY" | jq .

echo -e "\n${YELLOW}=== テスト完了 ===${NC}"