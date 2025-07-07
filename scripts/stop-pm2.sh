#!/bin/bash
# CC-Anywhere PM2停止スクリプト

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${BLUE}=== CC-Anywhere PM2 停止 ===${NC}"
echo ""

# PM2でアプリケーションを停止
echo -e "${YELLOW}PM2でCC-Anywhereを停止中...${NC}"
pm2 stop cc-anywhere 2>/dev/null || echo -e "${YELLOW}cc-anywhereは既に停止しています${NC}"

# プロセスを削除
pm2 delete cc-anywhere 2>/dev/null || true

# caffeinateプロセスを停止（macOSの場合）
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ -f "$PROJECT_DIR/.caffeinate.pid" ]; then
        CAFFEINATE_PID=$(cat "$PROJECT_DIR/.caffeinate.pid")
        if ps -p $CAFFEINATE_PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Caffeinateプロセスを停止中...${NC}"
            kill $CAFFEINATE_PID 2>/dev/null || true
        fi
        rm -f "$PROJECT_DIR/.caffeinate.pid"
    fi
    
    # 念のため、すべてのcaffeinateプロセスを確認
    pkill -f "caffeinate -disu" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}=== 停止完了 ===${NC}"
echo ""

# PM2のステータスを表示
pm2 status

echo ""
echo -e "${BLUE}ヒント:${NC}"
echo "  再起動する場合: ./scripts/start-pm2.sh"
echo "  PM2のログを削除: pm2 flush cc-anywhere"