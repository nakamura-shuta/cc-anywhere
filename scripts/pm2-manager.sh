#!/bin/bash
# CC-Anywhere PM2管理スクリプト

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"

# アプリケーション名
APP_NAME_BACKEND="cc-anywhere-backend"
APP_NAME_FRONTEND="cc-anywhere-frontend"

# ヘルプ表示
show_help() {
    echo -e "${BLUE}CC-Anywhere PM2 Manager${NC}"
    echo ""
    echo "使用方法: $0 [コマンド]"
    echo ""
    echo "コマンド:"
    echo "  start         - アプリケーションを起動（クラムシェルモード対応）"
    echo "  stop          - アプリケーションを停止"
    echo "  restart       - アプリケーションを再起動"
    echo "  status        - ステータスを表示"
    echo "  logs          - ログを表示（リアルタイム）"
    echo "  logs-error    - エラーログのみ表示"
    echo "  monitor       - PM2モニタリング画面を表示"
    echo "  info          - 詳細情報を表示"
    echo "  flush         - ログをクリア"
    echo "  reload        - グレースフルリロード"
    echo "  save          - 現在の状態を保存"
    echo "  resurrect     - 保存した状態を復元"
    echo ""
}

# ステータス確認
check_status() {
    if pm2 describe $APP_NAME_BACKEND > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 起動
start_app() {
    echo -e "${GREEN}CC-Anywhereを起動中...${NC}"
    
    # フロントエンドビルドチェック
    if [ ! -d "$PROJECT_DIR/frontend/build" ]; then
        echo -e "${YELLOW}フロントエンドのビルドが必要です...${NC}"
        cd "$PROJECT_DIR/frontend" && pnpm run build
    fi

    # バックエンドビルドチェック
    if [ ! -d "$BACKEND_DIR/dist" ]; then
        echo -e "${YELLOW}バックエンドのビルドが必要です...${NC}"
        cd "$BACKEND_DIR" && pnpm run build
    fi
    
    # PM2で起動
    cd "$BACKEND_DIR"
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start dist/index.js --name $APP_NAME_BACKEND
    fi
    
    # フロントエンドを静的サーバーとして起動
    cd "$PROJECT_DIR/frontend"
    pm2 serve build 3000 --name $APP_NAME_FRONTEND --spa
    
    # macOSの場合はcaffeinateも起動
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${GREEN}スリープ防止を有効化...${NC}"
        caffeinate -disu &
        echo $! > "$PROJECT_DIR/.caffeinate.pid"
        echo -e "${CYAN}MacBookを閉じても動作し続けます${NC}"
    fi
    
    # トンネル情報を表示
    sleep 3
    if grep -q "ENABLE_NGROK=true" "$PROJECT_DIR/.env" 2>/dev/null; then
        echo -e "${MAGENTA}ngrokが有効です。ログでURLを確認してください${NC}"
        pm2 logs $APP_NAME_BACKEND --lines 50 | grep -i "ngrok\|tunnel" || true
    fi
}

# 停止
stop_app() {
    echo -e "${YELLOW}CC-Anywhereを停止中...${NC}"
    pm2 stop $APP_NAME_BACKEND 2>/dev/null || echo "バックエンドは既に停止しています"
    pm2 delete $APP_NAME_BACKEND 2>/dev/null || true
    pm2 stop $APP_NAME_FRONTEND 2>/dev/null || echo "フロントエンドは既に停止しています"
    pm2 delete $APP_NAME_FRONTEND 2>/dev/null || true
    
    # caffeinateも停止
    if [ -f "$PROJECT_DIR/.caffeinate.pid" ]; then
        kill $(cat "$PROJECT_DIR/.caffeinate.pid") 2>/dev/null || true
        rm -f "$PROJECT_DIR/.caffeinate.pid"
    fi
}

# 情報表示
show_info() {
    echo -e "${BLUE}=== CC-Anywhere 情報 ===${NC}"
    echo ""
    
    if check_status; then
        echo -e "${GREEN}アプリケーションは実行中です${NC}"
        echo ""
        echo -e "${CYAN}バックエンド:${NC}"
        pm2 describe $APP_NAME_BACKEND | grep -E "status|cpu|memory" || true
        echo ""
        echo -e "${CYAN}フロントエンド:${NC}"
        pm2 describe $APP_NAME_FRONTEND | grep -E "status|cpu|memory" || true
        
        # URLを表示
        PORT=$(grep "^PORT=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "5000")
        echo ""
        echo -e "${CYAN}ローカルURL:${NC}"
        echo "  - バックエンド: http://localhost:$PORT"
        echo "  - フロントエンド: http://localhost:3000"
        
        # メモリ使用量
        echo ""
        echo -e "${YELLOW}リソース使用状況:${NC}"
        pm2 list | grep -E "$APP_NAME_BACKEND|$APP_NAME_FRONTEND" || true
    else
        echo -e "${RED}アプリケーションは停止しています${NC}"
    fi
    
    # caffeinate状態
    if [ -f "$PROJECT_DIR/.caffeinate.pid" ] && ps -p $(cat "$PROJECT_DIR/.caffeinate.pid") > /dev/null 2>&1; then
        echo -e "${GREEN}スリープ防止: 有効${NC}"
    else
        echo -e "${YELLOW}スリープ防止: 無効${NC}"
    fi
}

# メイン処理
case "$1" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    start-clamshell)
        # start-clamshell.shにリダイレクト
        "$SCRIPT_DIR/start-clamshell.sh"
        ;;
    restart)
        pm2 restart $APP_NAME_BACKEND
        pm2 restart $APP_NAME_FRONTEND
        ;;
    status)
        pm2 status
        ;;
    logs)
        echo -e "${CYAN}バックエンドログ:${NC}"
        pm2 logs $APP_NAME_BACKEND
        ;;
    logs-backend)
        pm2 logs $APP_NAME_BACKEND
        ;;
    logs-frontend)
        pm2 logs $APP_NAME_FRONTEND
        ;;
    logs-error)
        pm2 logs $APP_NAME_BACKEND --err
        ;;
    monitor)
        pm2 monit
        ;;
    info)
        show_info
        ;;
    flush)
        pm2 flush $APP_NAME_BACKEND
        pm2 flush $APP_NAME_FRONTEND
        echo -e "${GREEN}ログをクリアしました${NC}"
        ;;
    reload)
        pm2 reload $APP_NAME_BACKEND
        pm2 reload $APP_NAME_FRONTEND
        ;;
    save)
        pm2 save
        echo -e "${GREEN}現在の状態を保存しました${NC}"
        ;;
    resurrect)
        pm2 resurrect
        echo -e "${GREEN}保存した状態を復元しました${NC}"
        ;;
    *)
        show_help
        ;;
esac