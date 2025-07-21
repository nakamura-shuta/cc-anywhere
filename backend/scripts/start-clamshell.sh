#!/bin/bash
# CC-Anywhere クラムシェルモード起動スクリプト
# MacBookを閉じてもスマートフォンからアクセス可能

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

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     CC-Anywhere クラムシェルモード起動       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# プロジェクトディレクトリに移動
cd "$PROJECT_DIR"

# 1. 環境設定の確認と有効化
echo -e "${YELLOW}1. 環境設定を確認中...${NC}"

# 外部アクセス方法の選択
echo -e "${YELLOW}外部アクセス方法を選択してください:${NC}"
echo "1) ngrok (簡単・デフォルト)"
echo "2) Cloudflare Tunnel (高度)"
echo "3) なし (ローカルのみ)"
read -p "選択 [1-3] (デフォルト: 1): " choice
choice=${choice:-1}

case $choice in
    1)
        # ngrokを有効化
        echo -e "${GREEN}ngrokを使用します${NC}"
        if grep -q "ENABLE_NGROK=" .env; then
            sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=true/g' .env
        else
            echo "ENABLE_NGROK=true" >> .env
        fi
        if grep -q "TUNNEL_TYPE=" .env; then
            sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=ngrok/g' .env
        else
            echo "TUNNEL_TYPE=ngrok" >> .env
        fi
        ;;
    2)
        # Cloudflare Tunnelを有効化
        echo -e "${GREEN}Cloudflare Tunnelを使用します${NC}"
        if ! grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env || grep -q "CLOUDFLARE_TUNNEL_TOKEN=$" .env; then
            echo -e "${YELLOW}Cloudflare Tunnel Tokenが必要です${NC}"
            echo "https://dash.cloudflare.com でトンネルを作成してトークンを取得してください"
            read -p "Cloudflare Tunnel Token: " cf_token
            if grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env; then
                sed -i '' "s/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=$cf_token/g" .env
            else
                echo "CLOUDFLARE_TUNNEL_TOKEN=$cf_token" >> .env
            fi
        fi
        if grep -q "TUNNEL_TYPE=" .env; then
            sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=cloudflare/g' .env
        else
            echo "TUNNEL_TYPE=cloudflare" >> .env
        fi
        if grep -q "ENABLE_NGROK=" .env; then
            sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env
        fi
        ;;
    3)
        # ローカルのみ
        echo -e "${GREEN}ローカルアクセスのみ${NC}"
        if grep -q "ENABLE_NGROK=" .env; then
            sed -i '' 's/ENABLE_NGROK=.*/ENABLE_NGROK=false/g' .env
        fi
        if grep -q "TUNNEL_TYPE=" .env; then
            sed -i '' 's/TUNNEL_TYPE=.*/TUNNEL_TYPE=none/g' .env
        else
            echo "TUNNEL_TYPE=none" >> .env
        fi
        ;;
esac

# QRコード表示を確認
if ! grep -q "SHOW_QR_CODE=true" .env; then
    echo -e "${YELLOW}QRコード表示を有効化中...${NC}"
    sed -i '' 's/SHOW_QR_CODE=false/SHOW_QR_CODE=true/g' .env
fi

echo -e "${GREEN}✓ 外部アクセス設定完了${NC}"
echo -e "${GREEN}✓ QRコード: 有効${NC}"

# 2. ビルド確認
echo ""
echo -e "${YELLOW}2. ビルドを確認中...${NC}"
if [ ! -d "dist" ]; then
    npm run build
fi
echo -e "${GREEN}✓ ビルド完了${NC}"

# 3. 既存のプロセスを停止
echo ""
echo -e "${YELLOW}3. 既存のプロセスを停止中...${NC}"

# 開発モードのプロセスを停止
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true

# PM2プロセスを停止
pm2 stop cc-anywhere 2>/dev/null || true
pm2 delete cc-anywhere 2>/dev/null || true

# 既存のcaffeinateを停止
if [ -f "$PROJECT_DIR/.caffeinate.pid" ]; then
    kill $(cat "$PROJECT_DIR/.caffeinate.pid") 2>/dev/null || true
    rm -f "$PROJECT_DIR/.caffeinate.pid"
fi

echo -e "${GREEN}✓ クリーンアップ完了${NC}"

# 4. PM2で起動
echo ""
echo -e "${YELLOW}4. PM2で起動中...${NC}"

# ecosystem.config.jsを使用して起動
pm2 start ecosystem.config.js --env production

# PM2の自動起動設定
pm2 save
pm2 startup 2>/dev/null || echo -e "${YELLOW}※ pm2 startupコマンドを手動で実行してください${NC}"

# 5. スリープ防止を開始（macOSの場合）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo -e "${YELLOW}5. macOSのスリープ防止を開始...${NC}"
    
    # caffeinate を起動（すべてのスリープを防止）
    caffeinate -dims &
    CAFFEINATE_PID=$!
    echo $CAFFEINATE_PID > "$PROJECT_DIR/.caffeinate.pid"
    
    echo -e "${GREEN}✓ スリープ防止: 有効${NC}"
    echo -e "${MAGENTA}※ MacBookを閉じてもサーバーは動作し続けます${NC}"
fi

# 6. トンネルURLとQRコードを表示
echo ""
echo -e "${YELLOW}6. トンネルURLとQRコードを取得中...${NC}"
echo -e "${BLUE}（10秒程度かかります）${NC}"

# しばらく待機してからログを表示
sleep 10

# アプリケーションのURLを表示
PORT=$(grep "^PORT=" .env | cut -d'=' -f2 || echo "5000")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          セットアップ完了！                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}ローカルURL:${NC} http://localhost:$PORT"
echo ""

# トンネルURLとQRコードを表示
if [ "$choice" = "1" ]; then
    echo -e "${MAGENTA}=== ngrok URL と QRコード ===${NC}"
    # 保存されたQRコードファイルがあればそちらを優先表示
    if [ -f "$PROJECT_DIR/data/last-qr.txt" ] && [ -f "$PROJECT_DIR/data/last-access-info.json" ]; then
        "$SCRIPT_DIR/show-qr-direct.sh"
    else
        # ファイルがない場合はログから取得
        pm2 logs cc-anywhere --lines 200 --nostream --raw | awk '/External Access Information \(ngrok\)/,/^$/{print}' | tail -100
    fi
elif [ "$choice" = "2" ]; then
    echo -e "${MAGENTA}=== Cloudflare Tunnel URL と QRコード ===${NC}"
    # 保存されたQRコードファイルがあればそちらを優先表示
    if [ -f "$PROJECT_DIR/data/last-qr.txt" ] && [ -f "$PROJECT_DIR/data/last-access-info.json" ]; then
        "$SCRIPT_DIR/show-qr-direct.sh"
    else
        # ファイルがない場合はログから取得
        pm2 logs cc-anywhere --lines 200 --nostream --raw | awk '/External Access Information \(cloudflare\)/,/^$/{print}' | tail -100
    fi
fi

echo ""
echo -e "${GREEN}スマートフォンでアクセスする方法:${NC}"
echo "1. 上記のQRコードをスマートフォンのカメラで読み取る"
echo "2. または、URLを直接ブラウザに入力"
echo ""

echo -e "${YELLOW}管理コマンド:${NC}"
echo "  ログ確認:     pm2 logs cc-anywhere"
echo "  状態確認:     pm2 status"
echo "  停止:         ./scripts/pm2-manager.sh stop"
echo "  URL再表示:    ./scripts/tunnel-manager.sh show"
echo "  QRコード再表示: ./scripts/tunnel-manager.sh qr"
echo ""

echo -e "${MAGENTA}※ バッテリー節約のヒント:${NC}"
echo "  使用しない時は ./scripts/pm2-manager.sh stop で停止してください"
echo ""

# 最後にリアルタイムログを表示（Ctrl+Cで終了）
echo -e "${BLUE}リアルタイムログを表示します（Ctrl+Cで終了）:${NC}"
pm2 logs cc-anywhere --lines 0