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

# アプリケーション名
APP_NAME="cc-anywhere"

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
    echo "  scale [数]    - インスタンス数を変更"
    echo "  save          - 現在の状態を保存"
    echo "  resurrect     - 保存した状態を復元"
    echo ""
}

# ステータス確認
check_status() {
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 起動
start_app() {
    echo -e "${GREEN}CC-Anywhereを起動中...${NC}"
    
    # ビルドチェック
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        echo -e "${YELLOW}ビルドが必要です...${NC}"
        cd "$PROJECT_DIR" && npm run build
    fi
    
    # PM2で起動（ecosystem.config.jsを使用）
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js --env development
    
    # macOSの場合はcaffeinateも起動
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${GREEN}スリープ防止を有効化...${NC}"
        caffeinate -disu &
        echo $! > "$PROJECT_DIR/.caffeinate.pid"
        echo -e "${CYAN}MacBookを閉じても動作し続けます${NC}"
    fi
    
    # ngrok情報を表示
    sleep 3
    if grep -q "ENABLE_NGROK=true" "$PROJECT_DIR/.env" 2>/dev/null; then
        echo -e "${MAGENTA}ngrokが有効です。ログでURLを確認してください${NC}"
        pm2 logs $APP_NAME --lines 50 | grep -i "ngrok\|tunnel" || true
    fi
}

# 停止
stop_app() {
    echo -e "${YELLOW}CC-Anywhereを停止中...${NC}"
    pm2 stop $APP_NAME 2>/dev/null || echo "既に停止しています"
    pm2 delete $APP_NAME 2>/dev/null || true
    
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
        pm2 describe $APP_NAME
        echo ""
        echo -e "${GREEN}アプリケーションは実行中です${NC}"
        
        # URLを表示
        PORT=$(grep "^PORT=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "5000")
        echo -e "${CYAN}ローカルURL: http://localhost:$PORT${NC}"
        
        # メモリ使用量
        echo ""
        echo -e "${YELLOW}リソース使用状況:${NC}"
        pm2 list | grep $APP_NAME
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
    restart)
        pm2 restart $APP_NAME
        ;;
    status)
        pm2 status $APP_NAME
        ;;
    logs)
        pm2 logs $APP_NAME
        ;;
    logs-error)
        pm2 logs $APP_NAME --err
        ;;
    monitor)
        pm2 monit
        ;;
    info)
        show_info
        ;;
    flush)
        pm2 flush $APP_NAME
        echo -e "${GREEN}ログをクリアしました${NC}"
        ;;
    reload)
        pm2 reload $APP_NAME
        ;;
    scale)
        if [ -z "$2" ]; then
            echo -e "${RED}インスタンス数を指定してください${NC}"
            exit 1
        fi
        pm2 scale $APP_NAME $2
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