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
BACKEND_DIR="$PROJECT_DIR/backend"

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
    cd "$BACKEND_DIR"
    
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
    cd "$BACKEND_DIR"
    
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
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=ngrok/g' .env 2>/dev/null || echo "TUNNEL_TYPE=ngrok" >> .env
                sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=true/g' .env 2>/dev/null || echo "ENABLE_NGROK=true" >> .env
            else
                sed -i 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=ngrok/g' .env 2>/dev/null || echo "TUNNEL_TYPE=ngrok" >> .env
                sed -i 's/ENABLE_NGROK=.*/ENABLE_NGROK=true/g' .env 2>/dev/null || echo "ENABLE_NGROK=true" >> .env
            fi
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
                    if [ -f "$SCRIPT_DIR/setup-cloudflare-tunnel.sh" ]; then
                        "$SCRIPT_DIR/setup-cloudflare-tunnel.sh"
                    else
                        echo -e "${RED}setup-cloudflare-tunnel.sh が見つかりません${NC}"
                    fi
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
                        if [[ "$OSTYPE" == "darwin"* ]]; then
                            sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=cloudflare/g' .env 2>/dev/null || echo "TUNNEL_TYPE=cloudflare" >> .env
                            sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env 2>/dev/null
                            sed -i '' "s/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=$cf_token/g" .env 2>/dev/null || echo "CLOUDFLARE_TUNNEL_TOKEN=$cf_token" >> .env
                        else
                            sed -i 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=cloudflare/g' .env 2>/dev/null || echo "TUNNEL_TYPE=cloudflare" >> .env
                            sed -i 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env 2>/dev/null
                            sed -i "s/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=$cf_token/g" .env 2>/dev/null || echo "CLOUDFLARE_TUNNEL_TOKEN=$cf_token" >> .env
                        fi
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
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=none/g' .env 2>/dev/null || echo "TUNNEL_TYPE=none" >> .env
                sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env 2>/dev/null
            else
                sed -i 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=none/g' .env 2>/dev/null || echo "TUNNEL_TYPE=none" >> .env
                sed -i 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env 2>/dev/null
            fi
            echo -e "${GREEN}✓ ローカルのみの設定完了${NC}"
            ;;
    esac
}

# トンネルURLを表示
show_tunnel_url() {
    cd "$BACKEND_DIR"
    
    # サーバーが動作しているか確認
    if ! curl -s http://localhost:5000/health > /dev/null 2>&1; then
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
        # data/last-access-info.jsonまたはPM2ログから取得
        if [ -f "$BACKEND_DIR/data/last-access-info.json" ]; then
            jq -r '.url // "取得中..."' "$BACKEND_DIR/data/last-access-info.json" 2>/dev/null || echo "取得中..."
        else
            pm2 logs cc-anywhere-backend --lines 200 --nostream --raw | grep -o "https://.*\.trycloudflare\.com" | tail -1 || echo "取得中..."
        fi
    elif [ "$tunnel_type" = "ngrok" ] || [ "$(grep "^ENABLE_NGROK=" .env 2>/dev/null | cut -d'=' -f2)" = "true" ]; then
        echo -e "${MAGENTA}ngrok URL:${NC}"
        # data/last-access-info.jsonまたはPM2ログから取得
        if [ -f "$BACKEND_DIR/data/last-access-info.json" ]; then
            jq -r '.url // "取得中..."' "$BACKEND_DIR/data/last-access-info.json" 2>/dev/null || echo "取得中..."
        else
            pm2 logs cc-anywhere-backend --lines 200 --nostream --raw | grep -o "https://.*\.ngrok\(-free\)\?.app" | tail -1 || echo "取得中..."
        fi
    else
        echo -e "${YELLOW}外部アクセスは無効です${NC}"
    fi
    
    # ローカルURL
    local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "5000")
    echo ""
    echo -e "${BLUE}ローカルURL:${NC}"
    echo "  - バックエンド: http://localhost:$port"
    echo "  - フロントエンド: http://localhost:3000"
}

# QRコードを表示
show_qr_code() {
    cd "$BACKEND_DIR"
    
    if ! curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${RED}CC-Anywhereが起動していません${NC}"
        echo "起動: ./scripts/start-clamshell.sh"
        return 1
    fi
    
    # QRコード表示スクリプトを呼び出し
    if [ -f "$SCRIPT_DIR/show-qr-direct.sh" ]; then
        "$SCRIPT_DIR/show-qr-direct.sh"
    else
        echo -e "${YELLOW}QRコード情報の取得中...${NC}"
        if [ -f "$BACKEND_DIR/data/last-qr.txt" ]; then
            cat "$BACKEND_DIR/data/last-qr.txt"
        else
            echo -e "${RED}QRコードがまだ生成されていません${NC}"
        fi
    fi
}

# トンネルの状態確認
check_tunnel_status() {
    echo -e "${BLUE}=== トンネル状態 ===${NC}"
    echo ""
    
    show_current_config
    echo ""
    
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "サーバー: ${GREEN}実行中${NC}"
        
        # PM2プロセスの状態を確認
        if pm2 status | grep -q "cc-anywhere-backend"; then
            echo -e "PM2ステータス: ${GREEN}稼働中${NC}"
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