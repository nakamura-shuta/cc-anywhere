#!/bin/bash
# ngrok URLとQRコードを表示するスクリプト

set -e

# 色付き出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CC-Anywhere ngrok URL ===${NC}"
echo ""

# PM2が実行中か確認
if ! pm2 describe cc-anywhere > /dev/null 2>&1; then
    echo -e "${YELLOW}CC-Anywhereが起動していません${NC}"
    echo "起動: ./scripts/start-pm2.sh"
    exit 1
fi

# ログファイルから直接ngrok URLを検索
PM2_LOG_PATH="$HOME/.pm2/logs"
RECENT_LOG=$(ls -t "$PM2_LOG_PATH"/cc-anywhere-out*.log 2>/dev/null | head -1)

if [ -z "$RECENT_LOG" ]; then
    echo -e "${YELLOW}ログファイルが見つかりません${NC}"
    echo "pm2 logs cc-anywhere で確認してください"
    exit 1
fi

echo -e "${CYAN}ngrok情報を検索中...${NC}"
echo ""

# ngrok URLを検索
NGROK_URL=$(grep -o "https://.*\.ngrok.*\.app" "$RECENT_LOG" | tail -1)

if [ -n "$NGROK_URL" ]; then
    echo -e "${GREEN}ngrok URL:${NC}"
    echo -e "${CYAN}$NGROK_URL${NC}"
    echo ""
    
    # QRコードセクションを探して表示
    echo -e "${GREEN}QRコード:${NC}"
    # QRコードの開始位置を見つけて、その後の20行を表示
    if grep -n "▄▄▄▄▄▄▄" "$RECENT_LOG" > /dev/null; then
        # 最後のQRコードを表示
        tail -100 "$RECENT_LOG" | awk '/▄▄▄▄▄▄▄/{p=1} p && /^$/{if(++empty>1) exit} p'
    fi
else
    echo -e "${YELLOW}ngrok URLが見つかりません${NC}"
    echo ""
    echo "考えられる原因:"
    echo "1. ngrokがまだ起動していない（もう少し待ってください）"
    echo "2. ENABLE_NGROK=false になっている"
    echo "3. ネットワーク接続の問題"
    echo ""
    echo "ログを確認: pm2 logs cc-anywhere --lines 100"
fi

echo ""
echo -e "${BLUE}その他のコマンド:${NC}"
echo "  ステータス確認: pm2 status cc-anywhere"
echo "  リアルタイムログ: pm2 logs cc-anywhere"
echo "  完全なログ: tail -n 200 $RECENT_LOG"