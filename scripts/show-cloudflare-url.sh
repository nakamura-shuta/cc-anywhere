#!/bin/bash
# Cloudflare Tunnel URLとQRコードを表示するスクリプト

set -e

# 色付き出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CC-Anywhere Cloudflare Tunnel URL ===${NC}"
echo ""

# PM2が実行中か確認
if ! pm2 describe cc-anywhere > /dev/null 2>&1; then
    echo -e "${YELLOW}CC-Anywhereが起動していません${NC}"
    echo "起動: ./scripts/start-pm2.sh"
    exit 1
fi

# ログファイルから直接Cloudflare URLを検索
PM2_LOG_PATH="$HOME/.pm2/logs"
RECENT_LOG=$(ls -t "$PM2_LOG_PATH"/cc-anywhere-out*.log 2>/dev/null | head -1)

if [ -z "$RECENT_LOG" ]; then
    echo -e "${YELLOW}ログファイルが見つかりません${NC}"
    echo "pm2 logs cc-anywhere で確認してください"
    exit 1
fi

echo -e "${CYAN}Cloudflare Tunnel情報を検索中...${NC}"
echo ""

# Cloudflare URLを検索（.trycloudflare.comドメイン）
CLOUDFLARE_URL=$(grep -o "https://.*\.trycloudflare\.com" "$RECENT_LOG" | tail -1)

# カスタムドメインの場合も検索
if [ -z "$CLOUDFLARE_URL" ]; then
    CLOUDFLARE_URL=$(grep -o "https://[^[:space:]]*" "$RECENT_LOG" | grep -v "localhost" | tail -1)
fi

if [ -n "$CLOUDFLARE_URL" ]; then
    echo -e "${GREEN}Cloudflare Tunnel URL:${NC}"
    echo -e "${CYAN}$CLOUDFLARE_URL${NC}"
    echo ""
    
    # API Keyを.envから取得
    if [ -f ".env" ]; then
        API_KEY=$(grep "^API_KEY=" .env | cut -d'=' -f2)
        if [ -n "$API_KEY" ]; then
            echo -e "${GREEN}Web UI URL (with API Key):${NC}"
            echo -e "${CYAN}${CLOUDFLARE_URL}/?apiKey=${API_KEY}${NC}"
            echo ""
        fi
    fi
    
    # QRコードセクションを探して表示
    echo -e "${GREEN}QRコード:${NC}"
    # QRコードの開始位置を見つけて、その後の20行を表示
    if grep -n "▄▄▄▄▄▄▄" "$RECENT_LOG" > /dev/null; then
        # 最後のQRコードを表示
        tail -100 "$RECENT_LOG" | awk '/▄▄▄▄▄▄▄/{p=1} p && /^$/{if(++empty>1) exit} p'
    else
        echo -e "${YELLOW}QRコードが見つかりません。SHOW_QR_CODE=trueに設定してください。${NC}"
    fi
else
    echo -e "${YELLOW}Cloudflare Tunnel URLが見つかりません${NC}"
    echo ""
    echo "考えられる原因:"
    echo "1. Cloudflare Tunnelがまだ起動していない（もう少し待ってください）"
    echo "2. TUNNEL_TYPE=cloudflare になっていない"
    echo "3. cloudflaredがインストールされていない"
    echo "4. ネットワーク接続の問題"
    echo ""
    echo -e "${MAGENTA}cloudflaredのインストール:${NC}"
    echo "  brew install cloudflare/cloudflare/cloudflared"
    echo ""
    echo "ログを確認: pm2 logs cc-anywhere --lines 100"
fi

echo ""
echo -e "${BLUE}トンネルタイプの確認:${NC}"
grep "TUNNEL_TYPE" .env 2>/dev/null || echo "TUNNEL_TYPE が設定されていません"

echo ""
echo -e "${BLUE}その他のコマンド:${NC}"
echo "  ステータス確認: pm2 status cc-anywhere"
echo "  リアルタイムログ: pm2 logs cc-anywhere"
echo "  完全なログ: tail -n 200 $RECENT_LOG"
echo "  cloudflaredテスト: cloudflared tunnel --url http://localhost:5000"