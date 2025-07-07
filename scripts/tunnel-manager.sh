#!/bin/bash
# CC-Anywhere トンネル管理スクリプト (ngrok/Cloudflare)

set -e

# 色付き出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# ヘルプ表示
show_help() {
    echo -e "${BLUE}CC-Anywhere トンネル管理${NC}"
    echo ""
    echo "使用方法: $0 [コマンド]"
    echo ""
    echo "コマンド:"
    echo "  setup         - トンネルの初期設定"
    echo "  show          - 現在のトンネルURLを表示"
    echo "  switch        - トンネルタイプを切り替え"
    echo "  qr            - QRコードを再表示"
    echo "  status        - トンネルの状態を確認"
    echo "  help          - このヘルプを表示"
    echo ""
}

# 現在の設定を表示
show_current_config() {
    cd "$PROJECT_DIR"
    
    local tunnel_type=$(grep "^TUNNEL_TYPE=" .env 2>/dev/null | cut -d'=' -f2 || echo "none")
    local enable_ngrok=$(grep "^ENABLE_NGROK=" .env 2>/dev/null | cut -d'=' -f2 || echo "false")
    
    echo -e "${BLUE}現在のトンネル設定:${NC}"
    
    if [ "$tunnel_type" = "cloudflare" ]; then
        echo -e "  タイプ: ${GREEN}Cloudflare Tunnel${NC}"
        local cf_token=$(grep "^CLOUDFLARE_TUNNEL_TOKEN=" .env 2>/dev/null | cut -d'=' -f2 || echo "未設定")
        if [ -n "$cf_token" ] && [ "$cf_token" != "未設定" ]; then
            echo -e "  トークン: ${GREEN}設定済み${NC}"
        else
            echo -e "  トークン: ${RED}未設定${NC}"
        fi
    elif [ "$enable_ngrok" = "true" ] || [ "$tunnel_type" = "ngrok" ]; then
        echo -e "  タイプ: ${GREEN}ngrok${NC}"
    else
        echo -e "  タイプ: ${YELLOW}なし（ローカルのみ）${NC}"
    fi
}

# トンネルの設定
setup_tunnel() {
    cd "$PROJECT_DIR"
    
    echo -e "${YELLOW}トンネルのセットアップ${NC}"
    echo ""
    show_current_config
    echo ""
    
    echo "外部アクセス方法を選択してください:"
    echo "1) ngrok (簡単・無料)"
    echo "2) Cloudflare Tunnel (高度・独自ドメイン可)"
    echo "3) なし (ローカルのみ)"
    read -p "選択 [1-3]: " choice
    
    case $choice in
        1)
            echo -e "${GREEN}ngrokを設定します${NC}"
            sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=ngrok/g' .env 2>/dev/null || echo "TUNNEL_TYPE=ngrok" >> .env
            sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=true/g' .env 2>/dev/null || echo "ENABLE_NGROK=true" >> .env
            echo -e "${GREEN}✓ ngrok設定完了${NC}"
            ;;
        2)
            echo -e "${GREEN}Cloudflare Tunnelを設定します${NC}"
            echo ""
            echo "設定方法を選択してください:"
            echo "1) 自動セットアップ（APIで新規作成）- 推奨"
            echo "2) 手動セットアップ（既存のトークンを使用）"
            read -p "選択 [1-2]: " cf_choice
            
            case $cf_choice in
                1)
                    echo -e "${YELLOW}自動セットアップを実行します...${NC}"
                    "$SCRIPT_DIR/setup-cloudflare-tunnel.sh"
                    ;;
                2)
                    echo ""
                    echo "Cloudflare Tunnelの設定手順:"
                    echo "1. https://dash.cloudflare.com にログイン"
                    echo "2. Zero Trust > Access > Tunnels に移動"
                    echo "3. 新しいトンネルを作成"
                    echo "4. トークンをコピー"
                    echo ""
                    read -p "Cloudflare Tunnel Token: " cf_token
                    
                    if [ -n "$cf_token" ]; then
                        sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=cloudflare/g' .env 2>/dev/null || echo "TUNNEL_TYPE=cloudflare" >> .env
                        sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env 2>/dev/null
                        sed -i '' "s/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=$cf_token/g" .env 2>/dev/null || echo "CLOUDFLARE_TUNNEL_TOKEN=$cf_token" >> .env
                        echo -e "${GREEN}✓ Cloudflare Tunnel設定完了${NC}"
                    else
                        echo -e "${RED}トークンが入力されませんでした${NC}"
                        return 1
                    fi
                    ;;
                *)
                    echo -e "${RED}無効な選択です${NC}"
                    return 1
                    ;;
            esac
            ;;
        3)
            echo -e "${YELLOW}外部アクセスを無効化します${NC}"
            sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=none/g' .env 2>/dev/null || echo "TUNNEL_TYPE=none" >> .env
            sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env 2>/dev/null
            echo -e "${GREEN}✓ ローカルのみの設定完了${NC}"
            ;;
    esac
}

# トンネルURLを表示
show_tunnel_url() {
    cd "$PROJECT_DIR"
    
    # PM2が動作しているか確認
    if ! pm2 describe cc-anywhere > /dev/null 2>&1; then
        echo -e "${RED}CC-Anywhereが起動していません${NC}"
        echo "起動: ./scripts/start-clamshell.sh"
        return 1
    fi
    
    echo -e "${BLUE}=== トンネルURL ===${NC}"
    echo ""
    
    # ログから最新のURLを取得
    local tunnel_type=$(grep "^TUNNEL_TYPE=" .env 2>/dev/null | cut -d'=' -f2 || echo "none")
    
    if [ "$tunnel_type" = "cloudflare" ]; then
        echo -e "${MAGENTA}Cloudflare Tunnel URL:${NC}"
        pm2 logs cc-anywhere --lines 100 --nostream | grep -i "cloudflare.*https://" | tail -1
    elif [ "$tunnel_type" = "ngrok" ] || [ "$(grep "^ENABLE_NGROK=" .env 2>/dev/null | cut -d'=' -f2)" = "true" ]; then
        echo -e "${MAGENTA}ngrok URL:${NC}"
        pm2 logs cc-anywhere --lines 100 --nostream | grep -i "ngrok.*started\|https://.*ngrok" | grep -v "ngrok-free" | tail -1
    else
        echo -e "${YELLOW}外部アクセスは無効です${NC}"
    fi
    
    # ローカルURL
    local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "5000")
    echo ""
    echo -e "${BLUE}ローカルURL:${NC} http://localhost:$port"
}

# QRコードを表示
show_qr_code() {
    cd "$PROJECT_DIR"
    
    if ! pm2 describe cc-anywhere > /dev/null 2>&1; then
        echo -e "${RED}CC-Anywhereが起動していません${NC}"
        echo "起動: ./scripts/start-clamshell.sh"
        return 1
    fi
    
    # より詳細な表示のため専用スクリプトを呼び出し
    "$SCRIPT_DIR/show-full-qr.sh"
}

# トンネルの状態確認
check_tunnel_status() {
    cd "$PROJECT_DIR"
    
    echo -e "${BLUE}=== トンネル状態 ===${NC}"
    echo ""
    
    show_current_config
    echo ""
    
    if pm2 describe cc-anywhere > /dev/null 2>&1; then
        echo -e "サーバー: ${GREEN}実行中${NC}"
        
        # 最新のトンネル状態をログから確認
        local tunnel_type=$(grep "^TUNNEL_TYPE=" .env 2>/dev/null | cut -d'=' -f2 || echo "none")
        
        if [ "$tunnel_type" != "none" ]; then
            echo ""
            echo "最新のトンネルログ:"
            pm2 logs cc-anywhere --lines 50 --nostream | grep -i "tunnel\|ngrok\|cloudflare" | tail -5
        fi
    else
        echo -e "サーバー: ${RED}停止中${NC}"
    fi
}

# メイン処理
case "$1" in
    setup)
        setup_tunnel
        ;;
    show)
        show_tunnel_url
        ;;
    switch)
        setup_tunnel
        echo ""
        echo -e "${YELLOW}※ 設定を反映するにはサーバーを再起動してください${NC}"
        echo "  ./scripts/pm2-manager.sh restart"
        ;;
    qr)
        show_qr_code
        ;;
    status)
        check_tunnel_status
        ;;
    help|*)
        show_help
        ;;
esac