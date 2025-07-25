#!/bin/bash
# CC-Anywhere 全サーバー停止スクリプト

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      CC-Anywhere 全サーバー停止              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 停止カウンター
STOPPED_COUNT=0

# 1. PM2で動いているcc-anywhereを停止
echo -e "${YELLOW}1. PM2で動いているサーバーを確認中...${NC}"
if pm2 describe cc-anywhere > /dev/null 2>&1; then
    echo -e "${YELLOW}   PM2サーバーを停止中...${NC}"
    pm2 stop cc-anywhere 2>/dev/null || true
    pm2 delete cc-anywhere 2>/dev/null || true
    echo -e "${GREEN}   ✓ PM2サーバーを停止しました${NC}"
    ((STOPPED_COUNT++))
else
    echo -e "${BLUE}   PM2サーバーは動いていません${NC}"
fi

# 2. ポート5000で動いているプロセスを停止
echo -e "${YELLOW}2. ポート5000で動いているプロセスを確認中...${NC}"
if lsof -i :5000 > /dev/null 2>&1; then
    PIDS=$(lsof -ti :5000)
    for PID in $PIDS; do
        PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}   プロセス停止中: PID=$PID ($PROCESS_NAME)${NC}"
        kill -9 $PID 2>/dev/null || true
        ((STOPPED_COUNT++))
    done
    echo -e "${GREEN}   ✓ ポート5000のプロセスを停止しました${NC}"
else
    echo -e "${BLUE}   ポート5000で動いているプロセスはありません${NC}"
fi

# 3. 開発サーバー（npm run dev）のプロセスを停止
echo -e "${YELLOW}3. 開発サーバープロセスを確認中...${NC}"
# concurrentlyプロセスを探す
CONCURRENTLY_PIDS=$(pgrep -f "concurrently.*npm run dev" 2>/dev/null || true)
if [ ! -z "$CONCURRENTLY_PIDS" ]; then
    for PID in $CONCURRENTLY_PIDS; do
        echo -e "${YELLOW}   開発サーバープロセス停止中: PID=$PID${NC}"
        kill -9 $PID 2>/dev/null || true
        ((STOPPED_COUNT++))
    done
fi

# viteプロセスを探す
VITE_PIDS=$(pgrep -f "vite" 2>/dev/null || true)
if [ ! -z "$VITE_PIDS" ]; then
    for PID in $VITE_PIDS; do
        echo -e "${YELLOW}   Viteプロセス停止中: PID=$PID${NC}"
        kill -9 $PID 2>/dev/null || true
        ((STOPPED_COUNT++))
    done
fi

# tsxプロセスを探す
TSX_PIDS=$(pgrep -f "tsx watch" 2>/dev/null || true)
if [ ! -z "$TSX_PIDS" ]; then
    for PID in $TSX_PIDS; do
        echo -e "${YELLOW}   TSXプロセス停止中: PID=$PID${NC}"
        kill -9 $PID 2>/dev/null || true
        ((STOPPED_COUNT++))
    done
fi

if [ $((CONCURRENTLY_PIDS + VITE_PIDS + TSX_PIDS)) ]; then
    echo -e "${GREEN}   ✓ 開発サーバープロセスを停止しました${NC}"
else
    echo -e "${BLUE}   開発サーバープロセスは動いていません${NC}"
fi

# 4. caffeinateプロセスを停止
echo -e "${YELLOW}4. スリープ防止（caffeinate）を確認中...${NC}"
if [ -f "$BACKEND_DIR/.caffeinate.pid" ]; then
    CAFFEINATE_PID=$(cat "$BACKEND_DIR/.caffeinate.pid" 2>/dev/null || true)
    if [ ! -z "$CAFFEINATE_PID" ] && ps -p $CAFFEINATE_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}   caffeinateを停止中: PID=$CAFFEINATE_PID${NC}"
        kill $CAFFEINATE_PID 2>/dev/null || true
        ((STOPPED_COUNT++))
    fi
    rm -f "$BACKEND_DIR/.caffeinate.pid"
    echo -e "${GREEN}   ✓ スリープ防止を無効化しました${NC}"
else
    echo -e "${BLUE}   スリープ防止は有効ではありません${NC}"
fi

# 5. その他のcc-anywhere関連プロセスを確認
echo -e "${YELLOW}5. その他のcc-anywhere関連プロセスを確認中...${NC}"
CC_ANYWHERE_PIDS=$(pgrep -f "cc-anywhere" 2>/dev/null | grep -v $$ || true)
if [ ! -z "$CC_ANYWHERE_PIDS" ]; then
    for PID in $CC_ANYWHERE_PIDS; do
        PROCESS_CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}   関連プロセス停止中: PID=$PID${NC}"
        echo -e "${YELLOW}     コマンド: $PROCESS_CMD${NC}"
        kill -9 $PID 2>/dev/null || true
        ((STOPPED_COUNT++))
    done
    echo -e "${GREEN}   ✓ 関連プロセスを停止しました${NC}"
else
    echo -e "${BLUE}   その他の関連プロセスはありません${NC}"
fi

# 結果表示
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
if [ $STOPPED_COUNT -eq 0 ]; then
    echo -e "${GREEN}║   全てのサーバーは既に停止していました       ║${NC}"
else
    echo -e "${GREEN}║   $STOPPED_COUNT 個のプロセスを停止しました                ║${NC}"
fi
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ポート5000の最終確認
if lsof -i :5000 > /dev/null 2>&1; then
    echo -e "${RED}警告: ポート5000がまだ使用されています${NC}"
    echo -e "${YELLOW}残っているプロセス:${NC}"
    lsof -i :5000
else
    echo -e "${GREEN}✓ ポート5000は解放されています${NC}"
fi