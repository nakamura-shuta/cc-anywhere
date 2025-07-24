#!/bin/bash
# CC-Anywhere 全プロセス停止スクリプト
# 開発・本番すべてのプロセスを停止

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CC-Anywhere 全プロセス停止             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 1. PM2プロセスの停止
echo -e "${YELLOW}1. PM2プロセスを停止中...${NC}"

# PM2でcc-anywhereを停止
pm2 stop cc-anywhere-backend 2>/dev/null && echo "   cc-anywhere-backend: 停止" || echo "   cc-anywhere-backend: 未起動"
pm2 delete cc-anywhere-backend 2>/dev/null || true

# 旧名称も念のため停止
pm2 stop cc-anywhere 2>/dev/null && echo "   cc-anywhere: 停止" || true
pm2 delete cc-anywhere 2>/dev/null || true

echo -e "${GREEN}✓ PM2プロセス停止完了${NC}"
echo ""

# 2. 開発プロセスの停止
echo -e "${YELLOW}2. 開発プロセスを停止中...${NC}"

# バックエンド開発サーバー
pkill -f "tsx watch" 2>/dev/null && echo "   tsx watch: 停止" || echo "   tsx watch: 未起動"
pkill -f "npm run dev.*backend" 2>/dev/null && echo "   backend dev: 停止" || true

# フロントエンド開発サーバー
pkill -f "vite" 2>/dev/null && echo "   vite: 停止" || echo "   vite: 未起動"
pkill -f "npm run dev.*frontend" 2>/dev/null && echo "   frontend dev: 停止" || true

echo -e "${GREEN}✓ 開発プロセス停止完了${NC}"
echo ""

# 3. tmuxセッションの停止
echo -e "${YELLOW}3. tmuxセッションを確認中...${NC}"

if command -v tmux &> /dev/null; then
    tmux kill-session -t cc-anywhere 2>/dev/null && echo "   cc-anywhere session: 停止" || echo "   cc-anywhere session: 未起動"
fi

echo -e "${GREEN}✓ tmuxセッション確認完了${NC}"
echo ""

# 4. caffeinate（スリープ防止）の停止
echo -e "${YELLOW}4. スリープ防止を停止中...${NC}"

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"

# caffeinateプロセスを停止
if [ -f "$BACKEND_DIR/.caffeinate.pid" ]; then
    PID=$(cat "$BACKEND_DIR/.caffeinate.pid")
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID 2>/dev/null && echo "   caffeinate: 停止"
    fi
    rm -f "$BACKEND_DIR/.caffeinate.pid"
else
    echo "   caffeinate: 未起動"
fi

# 念のため全caffeinateプロセスを停止
pkill caffeinate 2>/dev/null || true

echo -e "${GREEN}✓ スリープ防止停止完了${NC}"
echo ""

# 5. ポート使用状況の確認
echo -e "${YELLOW}5. ポート使用状況を確認中...${NC}"

# ポート5000の確認
if lsof -i :5000 > /dev/null 2>&1; then
    echo -e "${YELLOW}   ポート5000: 使用中${NC}"
    echo "   以下のプロセスが使用しています:"
    lsof -i :5000 | grep LISTEN || true
else
    echo -e "${GREEN}   ポート5000: 空き${NC}"
fi

# ポート4444の確認（フロントエンド開発）
if lsof -i :4444 > /dev/null 2>&1; then
    echo -e "${YELLOW}   ポート4444: 使用中${NC}"
    echo "   以下のプロセスが使用しています:"
    lsof -i :4444 | grep LISTEN || true
else
    echo -e "${GREEN}   ポート4444: 空き${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         全プロセス停止完了！                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}次のコマンドで再起動できます:${NC}"
echo "  開発環境:   ./scripts/start-dev.sh"
echo "  本番環境:   ./scripts/start-production.sh"
echo "  クラムシェル: ./backend/scripts/start-clamshell.sh"
echo ""